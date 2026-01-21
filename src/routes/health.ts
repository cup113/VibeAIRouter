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

/**
 * 根路由
 */
router.get("/", (_req, res) => {
  res.json({
    name: "VibeAI Router",
    version: require("../../package.json").version,
    description: "AI routing service with load balancing and analytics",
    endpoints: {
      health: "/health",
      api: "/api/v1",
      docs: "/api-docs",
      models: "/api/v1/models",
      providers: "/api/v1/providers",
      chat: "/api/v1/chat/completions",
    },
    environment: process.env.NODE_ENV || "development",
  });
});

export { router as healthRouter };
