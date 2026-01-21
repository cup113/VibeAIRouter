import { Request, Response, NextFunction } from "express";

/**
 * 安全头部中间件
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("X-Powered-By", "VibeAI Router");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Vary", "Origin");
  }

  next();
}
