import { Router } from "express";
import { db } from "../../database";

const router: Router = Router();

/**
 * 服务状态端点
 */
router.get("/status", async (_req, res) => {
  try {
    const models = await db.getAllModels();
    const providers = await db.getAllProviders();

    res.json({
      service: "vibe-ai-router",
      status: "operational",
      timestamp: new Date().toISOString(),
      stats: {
        models: models.length,
        providers: providers.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      service: "vibe-ai-router",
      status: "degraded",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as statusRouter };
