import { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * 动态速率限制中间件工厂函数
 */
export function createRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    // 默认限制
    let maxRequests = 100;
    let windowMs = 15 * 60 * 1000; // 15分钟

    // 如果是API路由，应用更严格的限制
    if (
      req.path.startsWith("/api/v1/chat") ||
      req.path.startsWith("/api/v1/completions")
    ) {
      maxRequests = 50;
      windowMs = 5 * 60 * 1000; // 5分钟
    }

    const limiter = rateLimit({
      windowMs,
      max: maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "Too many requests, please try again later.",
        code: 429,
      },
      keyGenerator: () => ipKeyGenerator(clientIp),
      skip: (req: Request) => {
        // 健康检查不限制
        if (req.path === "/health" && NODE_ENV === "production") {
          return true;
        }
        return false;
      },
    });

    return limiter(req, res, next);
  };
}
