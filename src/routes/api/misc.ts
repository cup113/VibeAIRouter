import { Router } from "express";

const router: Router = Router();

/**
 * API 根路径
 */
router.get("/", (_req, res) => {
  res.json({
    message: "VibeAI API v1",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

/**
 * Echo 端点（用于测试）
 */
router.post("/echo", (req, res) => {
  res.json({
    message: "Echo received",
    data: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString(),
    requestId: (req as any).context?.requestId,
  });
});

export { router as miscRouter };
