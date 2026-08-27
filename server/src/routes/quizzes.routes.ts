import { Router } from "express";
import {
  quizInputSchema,
  quizQuestionOrderSchema,
  type QuizSummaryDto,
} from "@quiz/shared";
import { prisma } from "../db/prisma.ts";
import { assertCanEdit, optionalAuth, requireAuth, requireRole } from "../auth/middleware.ts";
import { HttpError, asyncHandler, parseBody } from "../utils/http.ts";
import { toQuestionDto } from "../utils/question.mapper.ts";
import { buildQuizAnalytics } from "../services/analytics.service.ts";

export const quizzesRouter = Router();

const authorOnly = [requireAuth, requireRole("TEACHER", "ADMIN")] as const;

interface QuizRow {
  id: string; title: string; description: string | null; coverImage: string | null;
  visibility: string; isPublished: boolean; allowTestMode: boolean;
  createdAt: Date; updatedAt: Date;
  owner: { id: string; displayName: string };
  _count: { questions: number };
}

function toQuizSummary(q: QuizRow): QuizSummaryDto {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    coverImage: q.coverImage,
    visibility: q.visibility as QuizSummaryDto["visibility"],
    isPublished: q.isPublished,
    allowTestMode: q.allowTestMode,
    questionCount: q._count.questions,
    owner: { id: q.owner.id, displayName: q.owner.displayName },
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

const summaryInclude = {
  owner: { select: { id: true, displayName: true } },
  _count: { select: { questions: true } },
} as const;

/**
 * Thư viện quiz. Khách chưa đăng nhập chỉ thấy quiz công khai đã xuất bản.
 * ?scope=mine trả về quiz của chính mình (kể cả riêng tư, chưa xuất bản).
 */
quizzesRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const me = req.user;
    const scope = req.query.scope === "mine" ? "mine" : "public";

    if (scope === "mine") {
      if (!me) throw HttpError.unauthorized();
      const quizzes = await prisma.quiz.findMany({
        where: { ownerId: me.id },
        include: summaryInclude,
        orderBy: { updatedAt: "desc" },
      });
      res.json({ quizzes: quizzes.map(toQuizSummary) });
      return;
    }

    const quizzes = await prisma.quiz.findMany({
      where: { visibility: "PUBLIC", isPublished: true },
      include: summaryInclude,
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
    res.json({ quizzes: quizzes.map(toQuizSummary) });
  })
);

quizzesRouter.post(
  "/",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const input = parseBody(quizInputSchema, req.body);
    const quiz = await prisma.quiz.create({
      data: {
        ...input,
        description: input.description ?? null,
        coverImage: input.coverImage ?? null,
        ownerId: req.user!.id,
        publishedAt: input.isPublished ? new Date() : null,
      },
      include: summaryInclude,
    });
    res.status(201).json({ quiz: toQuizSummary(quiz) });
  })
);

quizzesRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const me = req.user;
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: {
        ...summaryInclude,
        questions: {
          orderBy: { position: "asc" },
          include: { question: { include: { options: true } } },
        },
      },
    });
    if (!quiz) throw HttpError.notFound("Không tìm thấy bộ quiz.");

    const isOwner = !!me && (me.id === quiz.owner.id || me.role === "ADMIN");
    const isVisible = isOwner || (quiz.visibility === "PUBLIC" && quiz.isPublished);
    if (!isVisible) throw HttpError.forbidden("Bộ quiz này ở chế độ riêng tư.");

    // Đáp án đúng CHỈ gửi cho chủ sở hữu. Người chơi/làm bài không bao giờ nhận.
    res.json({
      quiz: toQuizSummary(quiz),
      questions: quiz.questions.map((qq) => toQuestionDto(qq.question, isOwner)),
      canEdit: isOwner,
    });
  })
);

quizzesRouter.patch(
  "/:id",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
    if (!quiz) throw HttpError.notFound();
    assertCanEdit(req.user, quiz.ownerId);

    const input = parseBody(quizInputSchema.partial(), req.body);
    const becomingPublished = input.isPublished === true && !quiz.isPublished;

    const updated = await prisma.quiz.update({
      where: { id: quiz.id },
      data: { ...input, ...(becomingPublished ? { publishedAt: new Date() } : {}) },
      include: summaryInclude,
    });
    res.json({ quiz: toQuizSummary(updated) });
  })
);

quizzesRouter.delete(
  "/:id",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
    if (!quiz) throw HttpError.notFound();
    assertCanEdit(req.user, quiz.ownerId);
    await prisma.quiz.delete({ where: { id: quiz.id } });
    res.json({ ok: true });
  })
);

/** Đặt lại toàn bộ danh sách + thứ tự câu hỏi của bộ quiz. */
quizzesRouter.put(
  "/:id/questions",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
    if (!quiz) throw HttpError.notFound();
    assertCanEdit(req.user, quiz.ownerId);

    const { questionIds } = parseBody(quizQuestionOrderSchema, req.body);

    // Chỉ nhận câu hỏi mà người dùng thực sự có quyền dùng.
    const me = req.user!;
    const usable = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
        ...(me.role === "ADMIN"
          ? {}
          : { bank: { OR: [{ ownerId: me.id }, { visibility: "PUBLIC" }] } }),
      },
      select: { id: true },
    });
    const usableIds = new Set(usable.map((q) => q.id));
    const ordered = questionIds.filter((id) => usableIds.has(id));

    if (ordered.length === 0) throw HttpError.badRequest("Không có câu hỏi hợp lệ nào.");

    await prisma.$transaction([
      prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } }),
      prisma.quizQuestion.createMany({
        data: ordered.map((questionId, i) => ({ quizId: quiz.id, questionId, position: i })),
      }),
    ]);

    res.json({ ok: true, count: ordered.length, skipped: questionIds.length - ordered.length });
  })
);

/** Thống kê cho giáo viên: câu nào đang làm khó học sinh. */
quizzesRouter.get(
  "/:id/analytics",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
    if (!quiz) throw HttpError.notFound();
    assertCanEdit(req.user, quiz.ownerId);
    res.json({ analytics: await buildQuizAnalytics(quiz.id) });
  })
);
