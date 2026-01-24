import { Router } from "express";
import { db } from "../../database";
import { Logger } from "../../logger";

const router: Router = Router();

/**
 * 服务状态端点
 */
router.get("/status", async (_req, res) => {
  try {
    const models = await db.getAllModels();
    const providers = await db.getAllProviders();

    // 获取今日统计信息
    const tokenStats = await db.getTodayTokenStats();
    const guestStats = await db.getTodayGuestStats();

    res.json({
      service: "vibe-ai-router",
      status: "operational",
      timestamp: new Date().toISOString(),
      stats: {
        models: models.length,
        providers: providers.length,
        today: {
          date: tokenStats.today,
          totalTokens: tokenStats.totalTokens,
          totalRequests: tokenStats.totalRequests,
          uniqueGuests: guestStats.uniqueGuests,
          guestRequests: guestStats.totalGuestRequests,
          guestTokens: guestStats.totalGuestTokens,
        },
      },
      _meta: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || "development",
        version: require("../../../package.json").version,
      },
    });
  } catch (error: any) {
    Logger.error("Error fetching status:", { error: error.message });

    res.status(500).json({
      service: "vibe-ai-router",
      status: "degraded",
      error: error.message,
      timestamp: new Date().toISOString(),
      stats: {
        models: 0,
        providers: 0,
        today: {
          date: new Date().toISOString().split("T")[0],
          totalTokens: 0,
          totalRequests: 0,
          uniqueGuests: 0,
          guestRequests: 0,
          guestTokens: 0,
        },
      },
    });
  }
});

/**
 * 获取今日详细统计
 */
router.get("/status/today", async (_req, res) => {
  try {
    const tokenStats = await db.getTodayTokenStats();
    const guestStats = await db.getTodayGuestStats();

    res.json({
      success: true,
      date: tokenStats.today,
      statistics: {
        tokens: {
          total: tokenStats.totalTokens,
          formatted: formatTokens(tokenStats.totalTokens),
        },
        requests: {
          total: tokenStats.totalRequests,
          perHour: calculatePerHour(tokenStats.totalRequests),
        },
        guests: {
          unique: guestStats.uniqueGuests,
          requests: guestStats.totalGuestRequests,
          tokens: guestStats.totalGuestTokens,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    Logger.error("Error fetching today's stats:", { error: error.message });

    res.status(500).json({
      success: false,
      error: "Failed to fetch today's statistics",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 辅助函数
function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(2)}K`;
  return `${(tokens / 1000000).toFixed(3)}M`;
}

function calculatePerHour(requests: number): number {
  const hours = new Date().getHours() + 1; // +1 避免除以0
  return Math.round(requests / hours);
}

export { router as statusRouter };
