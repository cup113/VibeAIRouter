import { Router } from "express";
import { db } from "../../database";
import { Logger } from "../../logger";

const router: Router = Router();

/**
 * 获取所有提供商
 * 注意：不返回任何敏感信息（如 apiKey）
 */
router.get("/providers", async (_req, res) => {
  try {
    const providers = await db.getAllProviders();

    // 安全地处理提供商数据，移除敏感信息
    const safeProviders = providers.map((provider) => ({
      id: provider.id,
      name: provider.name || "Unknown Provider",
      // 不包含 apiKey 和 baseUrl 等敏感信息
      created: provider.created,
      updated: provider.updated,
      // 只显示基本信息
      _meta: {
        hasApiKey: !!provider.apiKey,
        hasBaseUrl: !!provider.baseUrl,
      },
    }));

    res.json({
      success: true,
      data: safeProviders,
      count: safeProviders.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    Logger.error("Error fetching providers:", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to fetch providers",
      message: error.message,
    });
  }
});

/**
 * 获取单个提供商详情
 * 注意：不返回任何敏感信息
 */
router.get("/providers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 获取所有提供商然后过滤
    const providers = await db.getAllProviders();
    const provider = providers.find((p) => p.id === id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provider not found",
        message: `Provider with ID ${id} does not exist`,
      });
    }

    // 安全地处理提供商数据
    const safeProvider = {
      id: provider.id,
      name: provider.name || "Unknown Provider",
      // 不包含 apiKey 和 baseUrl 等敏感信息
      created: provider.created,
      updated: provider.updated,
      // 只显示基本信息
      _meta: {
        hasApiKey: !!provider.apiKey,
        hasBaseUrl: !!provider.baseUrl,
      },
    };

    return res.json({
      success: true,
      data: safeProvider,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    Logger.error("Error fetching provider:", { error: error.message });
    return res.status(500).json({
      success: false,
      error: "Failed to fetch provider",
      message: error.message,
    });
  }
});

export { router as providersRouter };
