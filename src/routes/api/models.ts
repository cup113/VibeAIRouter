import { Router } from "express";
import { db } from "../../database";
import { Logger } from "../../logger";

const router: Router = Router();

/**
 * 获取所有模型
 */
router.get("/models", async (req, res) => {
  try {
    const { provider } = req.query;
    const filters = provider ? { providerId: provider as string } : undefined;

    const models = await db.getAllModels(filters);

    res.json({
      success: true,
      data: models,
      count: models.length,
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

export { router as modelsRouter };
