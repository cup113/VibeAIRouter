import { Router } from "express";
import { db } from "../../database";
import { Logger } from "../../logger";
import { z } from "zod";

const router: Router = Router();

// 定义 Zod Schema 进行类型校验
const ChatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const ChatCompletionChoiceSchema = z.object({
  index: z.number(),
  message: z.object({
    role: z.string(),
    content: z.string(),
  }),
  finish_reason: z.string(),
});

const ChatCompletionUsageSchema = z.object({
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
});

const ChatCompletionResponseSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number(),
    model: z.string(),
    choices: z.array(ChatCompletionChoiceSchema),
    usage: ChatCompletionUsageSchema.optional(),
    system_fingerprint: z.string().optional(),
  })
  .loose();

const StreamingDeltaSchema = z
  .object({
    role: z.string().optional(),
    content: z.string().optional(),
    reasoningContent: z.string().optional(),
    tool_calls: z.array(z.any()).optional(),
  })
  .loose();

const StreamingChoiceSchema = z
  .object({
    index: z.number(),
    delta: StreamingDeltaSchema,
    finish_reason: z.string().nullish(),
  })
  .loose();

const StreamingChunkSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number(),
    model: z.string(),
    choices: z.array(StreamingChoiceSchema),
    usage: ChatCompletionUsageSchema.optional(),
  })
  .loose();

// 推导 TypeScript 类型

/**
 * 处理流式响应
 */
async function handleStreamingResponse(
  response: Response,
  res: any,
  guestId: string,
  modelId: string,
  startTime: number,
  providerName: string,
  requestId: string,
  modelCode: string,
) {
  // 设置流式响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-VibeAI-Model", modelCode);
  res.setHeader("X-VibeAI-Provider", providerName);
  res.setHeader("X-VibeAI-Request-ID", requestId);

  let firstTokenReceived = false;
  let firstTokenTime: number | undefined = undefined;
  let fullContent = "";
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    if (!response.body) {
      throw new Error("No response body available for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.trim() === "") continue;

        if (line.startsWith("data: ")) {
          const data = line.substring(6);

          if (data === "[DONE]") {
            // 发送结束标记
            res.write("data: [DONE]\n\n");

            // 创建使用日志
            await db.createUsageLog({
              guestId,
              modelId,
              tokenInput: promptTokens,
              tokenOutput: completionTokens,
              duration: Date.now() - startTime,
              firstTokenLatency: firstTokenTime
                ? firstTokenTime - startTime
                : undefined,
            });

            res.end();
            return;
          }

          try {
            const parsed = JSON.parse(data);

            // 使用 Zod 校验流式数据块，允许未定义字段
            const validationResult = StreamingChunkSchema.safeParse(parsed);

            if (!validationResult.success) {
              Logger.warn("Invalid streaming chunk format:", {
                data,
                error: validationResult.error.format(),
              });
              // 即使格式不符合，也尝试转发原始数据
              res.write(`data: ${data}\n\n`);
              continue;
            }

            const validatedChunk = validationResult.data;

            // 记录首 token 到达时间
            if (
              !firstTokenReceived &&
              validatedChunk.choices[0]?.delta?.content
            ) {
              firstTokenReceived = true;
              firstTokenTime = Date.now();
            }

            // 累积内容
            if (validatedChunk.choices[0]?.delta?.content) {
              fullContent += validatedChunk.choices[0].delta.content;
            }

            // 更新 token 计数（如果提供了）
            if (validatedChunk.usage) {
              promptTokens = validatedChunk.usage.prompt_tokens || promptTokens;
              completionTokens =
                validatedChunk.usage.completion_tokens || completionTokens;
            }

            // 转发数据给客户端
            res.write(`data: ${data}\n\n`);
          } catch (e) {
            Logger.warn("Failed to parse SSE data:", { data, error: e });
            // 即使解析失败，也尝试转发原始数据
            res.write(`data: ${data}\n\n`);
          }
        }
      }
    }
  } catch (error: any) {
    Logger.error("Streaming error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Streaming error",
        message: error.message,
        code: "STREAM_ERROR",
      });
    } else {
      res.end();
    }
  }
}

/**
 * AI 聊天补全端点
 */
router.post("/chat/completions", async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const { messages, model, stream = false, ...otherParams } = req.body;
  const startTime = Date.now();

  try {
    // 验证请求消息
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Bad request",
        message: "Messages array is required and must not be empty",
      });
    }

    // 验证每个消息的基本格式
    for (const message of messages) {
      const validation = ChatMessageSchema.safeParse(message);
      if (!validation.success) {
        return res.status(400).json({
          error: "Bad request",
          message: `Invalid message format: ${validation.error.message}`,
        });
      }
    }

    // 获取或创建访客记录
    const guest = await db.getOrCreateGuest(clientIp);

    // 查找模型
    const models = await db.getAllModels();
    const selectedModel = models.find((m) => m.code === model);

    if (!selectedModel) {
      return res.status(404).json({
        error: "Model not found",
        message: `Model '${model}' is not available`,
      });
    }

    // 获取提供商 API 密钥
    const apiKey = await db.getProviderApiKey(selectedModel.provider);

    if (!apiKey) {
      return res.status(500).json({
        error: "Provider configuration error",
        message: "API key not configured for this provider",
      });
    }

    const providerRecord =
      typeof selectedModel.expand?.provider === "object"
        ? selectedModel.expand.provider
        : null;
    const baseUrl = providerRecord?.baseUrl || "https://api.openai.com/v1";

    // 准备请求到实际 AI 提供商
    const requestBody = {
      messages,
      model: selectedModel.code,
      stream,
      ...otherParams,
    };

    // 强制加入使用统计（如果提供商支持）
    if (stream) {
      requestBody.stream_options = { include_usage: true };
    }

    // 发送请求到 AI 提供商
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Provider API error: ${response.status} ${errorText}`);
    }

    // 处理流式响应
    if (stream) {
      return await handleStreamingResponse(
        response,
        res,
        guest.id,
        selectedModel.id,
        startTime,
        providerRecord?.name || "unknown",
        (req as any).context.requestId,
        selectedModel.code,
      );
    }

    // 处理非流式响应
    const rawResult = await response.json();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // 使用 Zod 校验响应，允许未定义字段
    const validationResult = ChatCompletionResponseSchema.safeParse(rawResult);

    if (!validationResult.success) {
      Logger.warn("Invalid chat completion response format:", {
        error: validationResult.error.format(),
        rawResult: rawResult,
      });

      // 即使校验失败，我们也尝试处理基本的响应
      // 但为了安全性，我们只返回基本的错误信息
      const errorResponse = {
        error: "Invalid response format from provider",
        message: "The AI provider returned an unexpected response format",
        code: "INVALID_RESPONSE_FORMAT",
        _meta: {
          model: selectedModel.code,
          provider: providerRecord?.name,
          requestId: (req as any).context.requestId,
          processedBy: "VibeAI Router",
          timestamp: new Date().toISOString(),
        },
      };

      // 设置响应头
      res.setHeader("X-VibeAI-Model", selectedModel.code);
      res.setHeader("X-VibeAI-Provider", providerRecord?.name || "unknown");
      res.setHeader("X-VibeAI-Request-ID", (req as any).context.requestId);

      return res.status(502).json(errorResponse);
    }

    const result = validationResult.data;

    // 提取使用数据
    const tokensUsed = result.usage?.total_tokens || 0;
    const promptTokens = result.usage?.prompt_tokens || 0;
    const completionTokens = result.usage?.completion_tokens || 0;

    // 更新访客使用统计
    await db.updateGuestUsage(guest.id, tokensUsed);

    // 创建使用日志
    await db.createUsageLog({
      guestId: guest.id,
      modelId: selectedModel.id,
      tokenInput: promptTokens,
      tokenOutput: completionTokens,
      duration,
      // 对于非流式响应，首 token 延迟无法准确获取
      // 可以使用总延迟的某个比例估算，或直接使用总延迟
      firstTokenLatency: Math.round(duration * 0.3), // 估算值
    });

    // 添加自定义响应头
    res.setHeader("X-VibeAI-Model", selectedModel.code);
    res.setHeader("X-VibeAI-Provider", providerRecord?.name || "unknown");
    res.setHeader("X-VibeAI-Request-ID", (req as any).context.requestId);

    // 返回响应（保留所有原始字段）
    res.json({
      ...result,
      _meta: {
        model: selectedModel.code,
        provider: providerRecord?.name,
        requestId: (req as any).context.requestId,
        processedBy: "VibeAI Router",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    Logger.error("Chat completion error:", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      body: req.body,
    });

    // 确保在所有错误情况下都返回响应
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error.message,
        code: "CHAT_COMPLETION_ERROR",
      });
    } else {
      // 如果响应头已发送，结束响应
      res.end();
    }
  }
});

export { router as chatRouter };
