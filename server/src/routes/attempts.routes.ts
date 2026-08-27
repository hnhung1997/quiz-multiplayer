/**
 * Chế độ kiểm tra: toàn bộ câu hỏi hiện ra một lần như tờ đề, làm xong nộp một
 * lần, máy chủ chấm và lưu kết quả.
 *
 * BẤT BIẾN: `startAttempt` trả câu hỏi KHÔNG kèm `isCorrect`. Việc chấm chỉ xảy
 * ra ở `submit`, phía máy chủ. Đừng bao giờ nới lỏng điều này cho tiện.
 */
import { Router } from "express";
import {
  startAttemptSchema,
  submitAttemptSchema,
  type AttemptReviewDto,
  type AttemptReviewItemDto,
} from "@quiz/shared";
import { prisma } from "../db/prisma.ts";
import { requireAuth } from "../auth/middleware.ts";
import { HttpError, asyncHandler, parseBody } from "../utils/http.ts";
import { toQuestionDto } from "../utils/question.mapper.ts";
import { gradeTest } from "../services/grading.service.ts";
import { toAttemptSummary } from "../services/analytics.service.ts";

export const attemptsRouter = Router();

// Làm bài kiểm tra luôn cần đăng nhập — kết quả phải gắn được với tài khoản.
attemptsRouter.use(requireAuth);

async function loadQuizForAttempt(quizId: string, userId: string, role: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { position: "asc" },
        include: { question: { include: { options: { orderBy: { position: "asc" } } } } },
      },
    },
  });
  if (!quiz) throw HttpError.notFound("Không tìm thấy bộ quiz.");

  const isOwner = quiz.ownerId === userId || role === "ADMIN";
  if (!isOwner && !(quiz.visibility === "PUBLIC" && quiz.isPublished)) {
    throw HttpError.forbidden("Bộ quiz này ở chế độ riêng tư.");
  }
  if (!quiz.allowTestMode) throw HttpError.badRequest("Bộ quiz này không mở chế độ kiểm tra.");
  if (quiz.questions.length === 0) throw HttpError.badRequest("Bộ quiz chưa có câu hỏi nào.");

  return quiz;
}

/** Bắt đầu một lượt làm bài. */
attemptsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { quizId } = parseBody(startAttemptSchema, req.body);
    const me = req.user!;
    const quiz = await loadQuizForAttempt(quizId, me.id, me.role);

    // Nếu còn lượt đang làm dở cho chính bộ quiz này thì dùng lại, tránh sinh rác.
    const existing = await prisma.attempt.findFirst({
      where: { quizId, userId: me.id, mode: "TEST", status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
    });

    const attempt =
      existing ??
      (await prisma.attempt.create({
        data: {
          quizId,
          userId: me.id,
          mode: "TEST",
          status: "IN_PROGRESS",
          totalQuestions: quiz.questions.length,
          maxScore: quiz.questions.length,
        },
      }));

    res.status(existing ? 200 : 201).json({
      attemptId: attempt.id,
      quiz: { id: quiz.id, title: quiz.title, description: quiz.description },
      startedAt: attempt.startedAt.toISOString(),
      // false = KHÔNG kèm đáp án đúng. Đây là bất biến của ứng dụng.
      questions: quiz.questions.map((qq) => toQuestionDto(qq.question, false)),
    });
  })
);

/** Nộp bài và chấm. */
attemptsRouter.post(
  "/:id/submit",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const input = parseBody(submitAttemptSchema, req.body);

    const attempt = await prisma.attempt.findUnique({ where: { id: req.params.id } });
    if (!attempt) throw HttpError.notFound("Không tìm thấy lượt làm bài.");
    if (attempt.userId !== me.id) throw HttpError.forbidden();
    if (attempt.mode !== "TEST") throw HttpError.badRequest("Lượt này không phải bài kiểm tra.");
    if (attempt.status === "SUBMITTED") throw HttpError.conflict("Bài này đã nộp rồi.");

    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: attempt.quizId },
      include: {
        questions: {
          orderBy: { position: "asc" },
          include: { question: { include: { options: { orderBy: { position: "asc" } } } } },
        },
      },
    });

    const questions = quiz.questions.map((qq) => qq.question);
    const byId = new Map(questions.map((q) => [q.id, q]));
    const submitted = new Map(input.answers.map((a) => [a.questionId, a.optionId]));

    // Duyệt theo đề, không theo dữ liệu client gửi lên: câu bỏ trống vẫn phải
    // được chấm là sai, và câu lạ do client bịa ra thì bỏ qua.
    const gradeItems = questions.map((q) => {
      const chosen = submitted.get(q.id) ?? null;
      const validChoice = chosen !== null && q.options.some((o) => o.id === chosen) ? chosen : null;
      return {
        questionId: q.id,
        selectedOptionId: validChoice,
        correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? null,
      };
    });

    const result = gradeTest(gradeItems);
    const submittedAt = new Date();
    const durationMs = submittedAt.getTime() - attempt.startedAt.getTime();

    await prisma.$transaction([
      prisma.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } }),
      prisma.attemptAnswer.createMany({
        data: result.graded.map((g) => ({
          attemptId: attempt.id,
          questionId: g.questionId,
          selectedOptionId: g.selectedOptionId,
          isCorrect: g.isCorrect,
          pointsAwarded: g.pointsAwarded,
        })),
      }),
      prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED",
          score: result.score,
          maxScore: result.maxScore,
          correctCount: result.correctCount,
          totalQuestions: result.totalQuestions,
          durationMs,
          submittedAt,
        },
      }),
    ]);

    res.json({ review: await buildReview(attempt.id) });
  })
);

/** Xem lại chi tiết một lượt đã nộp. */
attemptsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const attempt = await prisma.attempt.findUnique({
      where: { id: req.params.id },
      include: { quiz: { select: { ownerId: true } } },
    });
    if (!attempt) throw HttpError.notFound();

    const isOwnerOfQuiz = attempt.quiz.ownerId === me.id;
    if (attempt.userId !== me.id && !isOwnerOfQuiz && me.role !== "ADMIN") {
      throw HttpError.forbidden();
    }
    if (attempt.status !== "SUBMITTED") {
      throw HttpError.badRequest("Lượt làm bài này chưa nộp.");
    }

    res.json({ review: await buildReview(attempt.id) });
  })
);

/**
 * Dựng lại bài đã chấm. Đến bước này đáp án đúng mới được gửi ra — bài đã nộp
 * xong nên không còn gì để lộ.
 */
async function buildReview(attemptId: string): Promise<AttemptReviewDto> {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      quiz: { select: { title: true } },
      answers: { include: { question: { include: { options: { orderBy: { position: "asc" } } } } } },
    },
  });

  const items: AttemptReviewItemDto[] = attempt.answers
    .sort((a, b) => a.question.position - b.question.position)
    .map((ans) => ({
      questionId: ans.questionId,
      questionText: ans.question.text,
      explanation: ans.question.explanation,
      options: ans.question.options.map((o) => ({
        id: o.id,
        position: o.position,
        text: o.text,
        color: o.color,
        isCorrect: o.isCorrect,
      })),
      selectedOptionId: ans.selectedOptionId,
      isCorrect: ans.isCorrect,
      pointsAwarded: ans.pointsAwarded,
      elapsedMs: ans.elapsedMs,
    }));

  return { ...toAttemptSummary(attempt), items };
}
