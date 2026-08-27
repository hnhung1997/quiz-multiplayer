import { Router } from "express";
import {
  bankInputSchema,
  legacyImportSchema,
  questionInputSchema,
  type BankSummaryDto,
} from "@quiz/shared";
import { prisma } from "../db/prisma.ts";
import { assertCanEdit, requireAuth, requireRole } from "../auth/middleware.ts";
import { HttpError, asyncHandler, parseBody } from "../utils/http.ts";
import { normalizeLegacyQuestion, toQuestionDto } from "../utils/question.mapper.ts";

export const banksRouter = Router();

const authorOnly = [requireAuth, requireRole("TEACHER", "ADMIN")] as const;

function toBankSummary(b: {
  id: string; title: string; description: string | null; visibility: string;
  ownerId: string; createdAt: Date; updatedAt: Date; _count: { questions: number };
}): BankSummaryDto {
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    visibility: b.visibility as BankSummaryDto["visibility"],
    questionCount: b._count.questions,
    ownerId: b.ownerId,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** Ngân hàng của mình + mọi ngân hàng công khai. */
banksRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const banks = await prisma.questionBank.findMany({
      where: me.role === "ADMIN" ? {} : { OR: [{ ownerId: me.id }, { visibility: "PUBLIC" }] },
      include: { _count: { select: { questions: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ banks: banks.map(toBankSummary) });
  })
);

banksRouter.post(
  "/",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const input = parseBody(bankInputSchema, req.body);
    const bank = await prisma.questionBank.create({
      data: { ...input, description: input.description ?? null, ownerId: req.user!.id },
      include: { _count: { select: { questions: true } } },
    });
    res.status(201).json({ bank: toBankSummary(bank) });
  })
);

banksRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const bank = await prisma.questionBank.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { questions: true } },
        questions: { include: { options: true }, orderBy: { position: "asc" } },
      },
    });
    if (!bank) throw HttpError.notFound("Không tìm thấy ngân hàng câu hỏi.");

    const isOwner = bank.ownerId === me.id || me.role === "ADMIN";
    if (!isOwner && bank.visibility !== "PUBLIC") throw HttpError.forbidden();

    res.json({
      bank: toBankSummary(bank),
      // Người soạn cần thấy đáp án đúng để sửa; đây không phải lúc đang làm bài.
      questions: bank.questions.map((q) => toQuestionDto(q, true)),
    });
  })
);

banksRouter.patch(
  "/:id",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const bank = await prisma.questionBank.findUnique({ where: { id: req.params.id } });
    if (!bank) throw HttpError.notFound();
    assertCanEdit(req.user, bank.ownerId);

    const input = parseBody(bankInputSchema.partial(), req.body);
    const updated = await prisma.questionBank.update({
      where: { id: bank.id },
      data: input,
      include: { _count: { select: { questions: true } } },
    });
    res.json({ bank: toBankSummary(updated) });
  })
);

banksRouter.delete(
  "/:id",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const bank = await prisma.questionBank.findUnique({ where: { id: req.params.id } });
    if (!bank) throw HttpError.notFound();
    assertCanEdit(req.user, bank.ownerId);
    await prisma.questionBank.delete({ where: { id: bank.id } });
    res.json({ ok: true });
  })
);

/* ─── Câu hỏi trong ngân hàng ──────────────────────────────────────────── */

banksRouter.post(
  "/:id/questions",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const bank = await prisma.questionBank.findUnique({ where: { id: req.params.id } });
    if (!bank) throw HttpError.notFound("Không tìm thấy ngân hàng câu hỏi.");
    assertCanEdit(req.user, bank.ownerId);

    const input = parseBody(questionInputSchema, req.body);
    const last = await prisma.question.findFirst({
      where: { bankId: bank.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const question = await prisma.question.create({
      data: {
        bankId: bank.id,
        text: input.text,
        explanation: input.explanation ?? null,
        imageCorrect: input.imageCorrect,
        imageWrong: input.imageWrong,
        timeLimit: input.timeLimit,
        points: input.points,
        position: (last?.position ?? -1) + 1,
        options: {
          create: input.options.map((o, i) => ({
            position: i,
            text: o.text,
            color: o.color ?? null,
            isCorrect: o.isCorrect,
          })),
        },
      },
      include: { options: true },
    });

    res.status(201).json({ question: toQuestionDto(question, true) });
  })
);

/**
 * Nhập ngân hàng câu hỏi từ localStorage của bản cũ.
 * Nhận đúng hình dạng đang nằm trong localStorage['pr_quiz_questions'].
 */
banksRouter.post(
  "/import",
  ...authorOnly,
  asyncHandler(async (req, res) => {
    const input = parseBody(legacyImportSchema, req.body);
    const me = req.user!;

    const normalized = input.questions
      .map(normalizeLegacyQuestion)
      .filter((q): q is NonNullable<typeof q> => q !== null);

    if (normalized.length === 0) {
      throw HttpError.badRequest("Không có câu hỏi nào hợp lệ để nhập.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const bank = await tx.questionBank.create({
        data: { ownerId: me.id, title: input.bankTitle, visibility: "PRIVATE" },
      });

      const created = [];
      for (const [i, q] of normalized.entries()) {
        created.push(
          await tx.question.create({
            data: {
              bankId: bank.id,
              text: q.text,
              explanation: q.explanation,
              imageCorrect: q.imageCorrect,
              imageWrong: q.imageWrong,
              timeLimit: q.timeLimit,
              position: i,
              options: {
                create: q.options.map((o, idx) => ({
                  position: idx,
                  text: o.text,
                  color: o.color,
                  isCorrect: o.isCorrect,
                })),
              },
            },
          })
        );
      }

      let quizId: string | null = null;
      if (input.createQuiz) {
        const quiz = await tx.quiz.create({
          data: {
            ownerId: me.id,
            title: input.bankTitle,
            description: "Nhập từ dữ liệu lưu trong trình duyệt.",
            visibility: "PRIVATE",
            isPublished: false,
          },
        });
        await tx.quizQuestion.createMany({
          data: created.map((q, i) => ({ quizId: quiz.id, questionId: q.id, position: i })),
        });
        quizId = quiz.id;
      }

      return { bankId: bank.id, quizId, imported: created.length };
    });

    res.status(201).json({
      ...result,
      skipped: input.questions.length - normalized.length,
    });
  })
);
