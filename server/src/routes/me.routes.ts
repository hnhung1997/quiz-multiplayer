import { Router } from "express";
import { prisma } from "../db/prisma.ts";
import { requireAuth } from "../auth/middleware.ts";
import { asyncHandler } from "../utils/http.ts";
import { buildMeStats, toAttemptSummary } from "../services/analytics.service.ts";

export const meRouter = Router();

meRouter.use(requireAuth);

/** Lịch sử làm bài + chơi, gộp chung một dòng thời gian. */
meRouter.get(
  "/attempts",
  asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit) || 25, 100);
    const skip = Math.max(Number(req.query.offset) || 0, 0);

    const [attempts, total] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId: req.user!.id, status: "SUBMITTED" },
        include: { quiz: { select: { title: true } } },
        orderBy: { submittedAt: "desc" },
        take,
        skip,
      }),
      prisma.attempt.count({ where: { userId: req.user!.id, status: "SUBMITTED" } }),
    ]);

    res.json({ attempts: attempts.map(toAttemptSummary), total, limit: take, offset: skip });
  })
);

meRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    res.json({ stats: await buildMeStats(req.user!.id) });
  })
);
