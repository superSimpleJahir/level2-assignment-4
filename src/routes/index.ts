import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "FixItNow API is healthy",
    data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
  });
});

export default router;
