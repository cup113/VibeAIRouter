import { Router } from "express";
import { db } from "../../database";
import { Logger } from "../../logger";

const router: Router = Router();

/**
 * 获取所有模型
 * 注意：不返回任何敏感信息
 */
router.get("/models", async (req, res) => {
  try {
    const { provider } = req.query;
    const filters = provider ? { providerId: provider as string } : undefined;

    const models = await db.getAllModels(filters);

    // 安全地处理模型数据，移除任何敏感信息
    const safeModels = models.map((model) => {
      // 创建安全的模型对象
      const safeModel: any = {
        id: model.id,
        code: model.code,
        name: model.name,
        created: model.created,
        updated: model.updated,
      };

      // 如果包含提供商信息，安全地处理提供商数据
      if (model.expand?.provider) {
        const provider = model.expand.provider;
        safeModel.provider = {
          id: provider.id,
          name: provider.name || "Unknown Provider",
          // 不包含 apiKey 和 baseUrl 等敏感信息
          created: provider.created,
          updated: provider.updated,
        };
      } else if (model.provider) {
        // 如果只有提供商ID，只返回ID
        safeModel.providerId = model.provider;
      }

      return safeModel;
    });

    res.json({
      success: true,
      data: safeModels,
      count: safeModels.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    Logger.error("Error fetching models:", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to fetch models",
      message: error.message,
    });
  }
});

/**
 * 获取单个模型详情
 */
router.get("/models/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 获取所有模型然后过滤
    const models = await db.getAllModels();
    const model = models.find((m) => m.id === id);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: "Model not found",
        message: `Model with ID ${id} does not exist`,
      });
    }

    // 安全地处理模型数据
    const safeModel: any = {
      id: model.id,
      code: model.code,
      name: model.name,
      created: model.created,
      updated: model.updated,
    };

    // 如果包含提供商信息，安全地处理提供商数据
    if (model.expand?.provider) {
      const provider = model.expand.provider;
      safeModel.provider = {
        id: provider.id,
        name: provider.name || "Unknown Provider",
        // 不包含 apiKey 和 baseUrl 等敏感信息
        created: provider.created,
        updated: provider.updated,
      };
    } else if (model.provider) {
      // 如果只有提供商ID，只返回ID
      safeModel.providerId = model.provider;
    }

    return res.json({
      success: true,
      data: safeModel,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    Logger.error("Error fetching model:", { error: error.message });
    return res.status(500).json({
      success: false,
      error: "Failed to fetch model",
      message: error.message,
    });
  }
});

export { router as modelsRouter };
