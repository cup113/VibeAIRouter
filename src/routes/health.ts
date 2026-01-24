import { Router } from "express";
import { db } from "../database";

const router: Router = Router();

/**
 * 健康检查路由
 */
router.get("/health", async (_req, res) => {
  const dbHealth = await db.healthCheck();

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    memory: process.memoryUsage(),
    version: require("../../package.json").version,
    database: dbHealth,
  });
});

export { router as healthRouter };
