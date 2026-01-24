# VibeAI Router API 概览

## 简介

VibeAI Router 是一个开源的 AI 模型路由服务，提供统一的 API 接口来访问不同的 AI 模型。本项目兼容 OpenAI API 规范，让你可以通过一个统一的接口访问多个 AI 提供商。

## 基础信息

- **API 版本**: v1
- **基础路径**: `/api/v1`
- **协议**: HTTP/HTTPS
- **响应格式**: JSON
- **开发语言**: TypeScript
- **框架**: Express.js

## 认证与安全

VibeAI Router 本身不需要认证即可访问元数据和状态信息。但是，对于 AI 模型的实际调用（`/chat/completions`），服务会自动使用配置的提供商 API 密钥。

### 请求头

所有 API 请求建议包含以下请求头：

```http
Content-Type: application/json
Accept: application/json
```

### 速率限制

为防止滥用，API 实施了速率限制。默认配置为：

- 每个 IP 地址：**每分钟 60 次请求**
- 每个端点可能有不同的限制策略

## 响应格式

### 成功响应

所有成功的 API 请求都会返回 200 状态码和以下格式的响应：

```json
{
  "success": true,
  "data": { /* 响应数据 */ },
  "timestamp": "2024-01-01T12:00:00.000Z",
  "count": 10 // 如果适用
}
```

### 错误响应

错误响应遵循以下格式：

```json
{
  "success": false,
  "error": "错误类型",
  "message": "详细的错误信息",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "code": "ERROR_CODE" // 可选的错误代码
}
```

常见 HTTP 状态码：

- `200`: 请求成功
- `400`: 请求参数错误
- `404`: 资源不存在
- `429`: 请求过于频繁（超出速率限制）
- `500`: 服务器内部错误
- `502`: 提供商 API 错误

## API 端点概览

### 1. 服务状态与监控

| 端点 | 方法 | 描述 |
|------|------|------|
| `/` | GET | API 根路径，返回基本信息 |
| `/echo` | POST | 回显测试端点，返回请求数据 |
| `/status` | GET | 获取服务状态和整体统计 |
| `/status/today` | GET | 获取今日详细统计信息 |

### 2. 模型管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/models` | GET | 获取所有可用模型列表 |
| `/models/:id` | GET | 获取单个模型详细信息 |

### 3. 提供商管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/providers` | GET | 获取所有 AI 提供商列表 |
| `/providers/:id` | GET | 获取单个提供商详细信息 |

### 4. AI 聊天接口

| 端点 | 方法 | 描述 |
|------|------|------|
| `/chat/completions` | POST | AI 聊天补全接口（OpenAI 兼容） |

## 详细端点说明

### API 根路径

**GET `/api/v1/`**

返回 API 的基本信息。

**响应示例：**
```json
{
  "message": "VibeAI API v1",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### 服务状态

**GET `/api/v1/status`**

返回服务的完整状态信息，包括：
- 服务运行状态
- 可用模型和提供商数量
- 今日使用统计
- 系统元数据（运行时间、内存使用等）

**响应示例：**
```json
{
  "service": "vibe-ai-router",
  "status": "operational",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "stats": {
    "models": 8,
    "providers": 3,
    "today": {
      "date": "2024-01-01",
      "totalTokens": 123456,
      "totalRequests": 89,
      "uniqueGuests": 42,
      "guestRequests": 89,
      "guestTokens": 123456
    }
  },
  "_meta": {
    "uptime": 3600,
    "memory": {
      "rss": 102400000,
      "heapTotal": 51200000,
      "heapUsed": 25600000,
      "external": 12800000
    },
    "environment": "production",
    "version": "1.0.0"
  }
}
```

### 今日统计详情

**GET `/api/v1/status/today`**

返回今日使用统计的详细视图。

**响应示例：**
```json
{
  "success": true,
  "date": "2024-01-01",
  "statistics": {
    "tokens": {
      "total": 123456,
      "formatted": "123.456K"
    },
    "requests": {
      "total": 89,
      "perHour": 3
    },
    "guests": {
      "unique": 42,
      "requests": 89,
      "tokens": 123456
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 模型列表

**GET `/api/v1/models`**

获取所有可用模型列表。支持通过查询参数筛选：

- `provider`: 按提供商 ID 筛选模型

**查询参数示例：**
```
GET /api/v1/models?provider=provider_123
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "model_abc123",
      "code": "Qwen3-8B",
      "name": "Qwen3-8B",
      "created": "2024-01-01T10:00:00.000Z",
      "updated": "2024-01-01T10:00:00.000Z",
      "provider": {
        "id": "provider_123",
        "name": "OpenAI",
        "created": "2024-01-01T09:00:00.000Z",
        "updated": "2024-01-01T09:00:00.000Z"
      }
    }
  ],
  "count": 8,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 提供商列表

**GET `/api/v1/providers`**

获取所有 AI 提供商列表。

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "provider_123",
      "name": "OpenAI",
      "created": "2024-01-01T09:00:00.000Z",
      "updated": "2024-01-01T09:00:00.000Z",
      "_meta": {
        "hasApiKey": true,
        "hasBaseUrl": true
      }
    }
  ],
  "count": 3,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### AI 聊天接口

**POST `/api/v1/chat/completions`**

提供与 OpenAI API 兼容的聊天补全接口。支持流式和非流式响应。

**请求格式：**
```json
{
  "model": "Qwen3-8B",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "stream": false
}
```

**参数说明：**
- `model`: 要使用的模型代码（必需）
- `messages`: 消息数组（必需）
- `stream`: 是否使用流式响应（可选，默认 false）
- 其他与 OpenAI API 兼容的参数

**非流式响应示例：**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "Qwen3-8B",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking. How can I assist you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  },
  "_meta": {
    "model": "Qwen3-8B",
    "provider": "OpenAI",
    "requestId": "req_abc123",
    "processedBy": "VibeAI Router",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**流式响应：**
设置 `stream: true` 后，响应将使用 Server-Sent Events (SSE) 格式返回。

## 快速开始

### 1. 检查服务状态

```bash
curl http://localhost:3000/api/v1/status
```

### 2. 查看可用模型

```bash
curl http://localhost:3000/api/v1/models
```

### 3. 使用 AI 聊天接口

```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen3-8B",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "stream": false
  }'
```

### 4. 使用流式响应

```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen3-8B",
    "messages": [
      {"role": "user", "content": "Tell me a short story"}
    ],
    "stream": true
  }'
```

## 自定义响应头

AI 聊天接口返回以下自定义响应头：

- `X-VibeAI-Model`: 实际使用的模型代码
- `X-VibeAI-Provider`: 模型提供商名称
- `X-VibeAI-Request-ID`: 请求的唯一标识符

## 注意事项

1. **错误处理**: 所有错误都有统一的错误格式和适当的 HTTP 状态码
2. **向后兼容**: AI 聊天接口完全兼容 OpenAI API 规范
3. **监控统计**: 系统自动跟踪使用统计，可在状态端点查看
4. **多租户支持**: 基于 IP 地址的访客跟踪和使用统计

## 故障排除

### 常见问题

1. **模型不可用**: 确保模型已正确配置并在 `/api/v1/models` 端点中列出
2. **速率限制**: 如果收到 429 状态码，请降低请求频率
3. **提供商错误**: 如果收到 502 状态码，可能是提供商 API 出现问题

### 日志查看

详细的错误日志存储在 `logs/` 目录中，可通过服务日志进行故障排除。

## 联系与支持

如有问题或需要帮助，请参考项目文档或提交 Issue。
