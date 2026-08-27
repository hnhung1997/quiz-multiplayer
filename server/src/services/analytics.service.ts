/**
 * Thống kê kết quả. Vì bài kiểm tra và ván chơi trực tiếp cùng nằm trong bảng
 * `attempts`, mọi con số dưới đây chỉ cần một đường truy vấn duy nhất.
 */
import type { AttemptSummaryDto, MeStatsDto, QuizAnalyticsDto } from "@quiz/shared";
import { prisma } from "../db/prisma.ts";
import { HttpError } from "../utils/http.ts";

interface AttemptRow {
  id: string; quizId: string; mode: string; score: number; maxScore: number;
  correctCount: number; totalQuestions: number; rank: number | null;
  durationMs: number | null; submittedAt: Date | null;
  quiz: { title: string };
}

export function toAttemptSummary(a: AttemptRow): AttemptSummaryDto {
  return {
    id: a.id,
    quizId: a.quizId,
    quizTitle: a.quiz.title,
    mode: a.mode as AttemptSummaryDto["mode"],
    score: a.score,
    maxScore: a.maxScore,
    correctCount: a.correctCount,
    totalQuestions: a.totalQuestions,
    accuracy: a.totalQuestions === 0 ? 0 : a.correctCount / a.totalQuestions,
    rank: a.rank,
    durationMs: a.durationMs,
    submittedAt: a.submittedAt?.toISOString() ?? null,
  };
}

export async function buildQuizAnalytics(quizId: string): Promise<QuizAnalyticsDto> {
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

  const attempts = await prisma.attempt.findMany({
    where: { quizId, status: "SUBMITTED" },
    select: { id: true, score: true, maxScore: true },
  });

  const answers = await prisma.attemptAnswer.findMany({
    where: { attempt: { quizId, status: "SUBMITTED" } },
    select: { questionId: true, selectedOptionId: true, isCorrect: true },
  });

  const byQuestion = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = byQuestion.get(a.questionId) ?? [];
    list.push(a);
    byQuestion.set(a.questionId, list);
  }

  const scored = attempts.filter((a) => a.maxScore > 0);
  const averageScorePct =
    scored.length === 0
      ? 0
      : scored.reduce((sum, a) => sum + a.score / a.maxScore, 0) / scored.length;

  return {
    quizId,
    quizTitle: quiz.title,
    attemptCount: attempts.length,
    averageScorePct,
    questions: quiz.questions.map((qq) => {
      const q = qq.question;
      const rows = byQuestion.get(q.id) ?? [];
      const correctCount = rows.filter((r) => r.isCorrect).length;

      return {
        questionId: q.id,
        questionText: q.text,
        answeredCount: rows.length,
        correctCount,
        correctPct: rows.length === 0 ? 0 : correctCount / rows.length,
        distribution: q.options.map((o) => ({
          optionId: o.id,
          text: o.text,
          count: rows.filter((r) => r.selectedOptionId === o.id).length,
          isCorrect: o.isCorrect,
        })),
      };
    }),
  };
}

export async function buildMeStats(userId: string): Promise<MeStatsDto> {
  const attempts = await prisma.attempt.findMany({
    where: { userId, status: "SUBMITTED" },
    include: { quiz: { select: { title: true } } },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });

  const summaries = attempts.map(toAttemptSummary);
  const withQuestions = summaries.filter((a) => a.totalQuestions > 0);

  return {
    totalAttempts: summaries.length,
    liveAttempts: summaries.filter((a) => a.mode === "LIVE").length,
    testAttempts: summaries.filter((a) => a.mode === "TEST").length,
    averageAccuracy:
      withQuestions.length === 0
        ? 0
        : withQuestions.reduce((s, a) => s + a.accuracy, 0) / withQuestions.length,
    bestScore: summaries.reduce((m, a) => Math.max(m, a.score), 0),
    recent: summaries.slice(0, 10),
  };
}
