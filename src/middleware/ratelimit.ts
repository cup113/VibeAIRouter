import { Request, Response, NextFunction } from "express";
import rateLimit, {
  ipKeyGenerator,
  RateLimitRequestHandler,
} from "express-rate-limit";

const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * 创建通用速率限制器
 */
export function createGeneralRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests, please try again later.",
      code: 429,
    },
    keyGenerator: (req: Request) => {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      return ipKeyGenerator(clientIp);
    },
    skip: (req: Request) => {
      // 健康检查不限制
      if (req.path === "/health" && NODE_ENV === "production") {
        return true;
      }
      return false;
    },
  });
}

/**
 * 创建API速率限制器（更严格）
 */
export function createApiRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 5 * 60 * 1000, // 5分钟
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many API requests, please try again later.",
      code: 429,
    },
    keyGenerator: (req: Request) => {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      return ipKeyGenerator(clientIp);
    },
    skip: (req: Request) => {
      // 健康检查不限制
      if (req.path === "/health" && NODE_ENV === "production") {
        return true;
      }
      return false;
    },
  });
}

/**
 * 动态速率限制中间件
 * 根据路由选择不同的速率限制器
 */
export function dynamicRateLimiter(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  // 在应用初始化时创建速率限制器实例
  const generalLimiter = createGeneralRateLimiter();
  const apiLimiter = createApiRateLimiter();

  return (req: Request, res: Response, next: NextFunction) => {
    // 根据路由选择不同的限制器
    if (
      req.path.startsWith("/api/v1/chat") ||
      req.path.startsWith("/api/v1/completions")
    ) {
      return apiLimiter(req, res, next);
    } else {
      return generalLimiter(req, res, next);
    }
  };
}

/**
 * 创建速率限制器（向后兼容）
 * @deprecated 使用 dynamicRateLimiter() 替代
 */
export function createRateLimiter() {
  return dynamicRateLimiter();
}
