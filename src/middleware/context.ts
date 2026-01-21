import { Request, Response, NextFunction } from "express";
import { db } from "../database";
import { Logger } from "../logger";

/**
 * 请求上下文中间件
 * 初始化请求上下文并检查黑名单
 */
export async function contextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 初始化请求上下文
  (req as any).context = {
    startTime: Date.now(),
    requestId: Math.random().toString(36).substring(7),
  };

  try {
    // 检查黑名单
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const isBlacklisted = await db.isGuestBlacklisted(clientIp);

    if (isBlacklisted) {
      Logger.warn(`Blacklisted IP attempted access: ${clientIp}`);
      res.status(403).json({
        error: "Access denied",
        message: "Your IP address has been blacklisted",
        code: 403,
      });
      return;
    }
  } catch (error) {
    // 如果数据库检查失败，继续处理请求
    Logger.warn("Failed to check blacklist status", { error });
  }

  next();
}
