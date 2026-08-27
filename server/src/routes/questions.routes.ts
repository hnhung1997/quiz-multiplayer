import { Router } from "express";
import { questionInputSchema } from "@quiz/shared";
import { prisma } from "../db/prisma.ts";
import { assertCanEdit, requireAuth, requireRole } from "../auth/middleware.ts";
import { HttpError, asyncHandler, parseBody } from "../utils/http.ts";
import { toQuestionDto } from "../utils/question.mapper.ts";

export const questionsRouter = Router();

questionsRouter.use(requireAuth, requireRole("TEACHER", "ADMIN"));

async function loadOwnedQuestion(id: string | undefined) {
  const question = await prisma.question.findUnique({
    where: { id: id ?? "" },
    include: { options: true, bank: { select: { ownerId: true } } },
  });
  if (!question) throw HttpError.notFound("Không tìm thấy câu hỏi.");
  return question;
}

questionsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const question = await loadOwnedQuestion(req.params.id);
    assertCanEdit(req.user, question.bank.ownerId);

    const input = parseBody(questionInputSchema, req.body);

    // Thay toàn bộ đáp án cho gọn: số lượng nhỏ, và tránh phải khớp từng dòng.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.questionOption.deleteMany({ where: { questionId: question.id } });
      return tx.question.update({
        where: { id: question.id },
        data: {
          text: input.text,
          explanation: input.explanation ?? null,
          imageCorrect: input.imageCorrect,
          imageWrong: input.imageWrong,
          timeLimit: input.timeLimit,
          points: input.points,
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
    });

    res.json({ question: toQuestionDto(updated, true) });
  })
);

questionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const question = await loadOwnedQuestion(req.params.id);
    assertCanEdit(req.user, question.bank.ownerId);
    await prisma.question.delete({ where: { id: question.id } });
    res.json({ ok: true });
  })
);
