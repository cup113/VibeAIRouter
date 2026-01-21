import { Router } from "express";
import { db } from "../../database";
import { Logger } from "../../logger";

const router: Router = Router();

/**
 * 获取所有提供商
 */
router.get("/providers", async (_req, res) => {
  try {
    const providers = await db.getAllProviders();

    res.json({
      success: true,
      data: providers.map((p) => ({
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        createdAt: p.created,
        updatedAt: p.updated,
      })),
      count: providers.length,
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

export { router as providersRouter };
