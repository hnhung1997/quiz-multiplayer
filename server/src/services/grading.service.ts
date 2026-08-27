/**
 * Nơi DUY NHẤT tính điểm, cho cả chơi trực tiếp lẫn làm bài kiểm tra.
 *
 * Công thức chế độ trực tiếp được bê nguyên từ `endQuestion()` trong server.js
 * bản cũ — kể cả thứ tự làm tròn — để điểm số không đổi sau khi tái cấu trúc:
 *
 *     gained = round(500 + 500 * timeFrac)      // làm tròn TRƯỚC
 *     gained += min(streak - 1, 5) * 20         // rồi mới cộng thưởng chuỗi
 */
import { SCORING } from "@quiz/shared";

export interface LiveScoreInput {
  correct: boolean;
  /** Thời gian trả lời tính bằng ms kể từ lúc câu hỏi hiện ra. */
  elapsedMs: number;
  /** Giới hạn thời gian của câu hỏi, tính bằng giây. */
  timeLimitSec: number;
  /** Chuỗi trả lời đúng TRƯỚC câu này. */
  previousStreak: number;
}

export interface LiveScoreResult {
  gained: number;
  streak: number;
}

export function scoreLiveAnswer(input: LiveScoreInput): LiveScoreResult {
  if (!input.correct) {
    return { gained: 0, streak: 0 };
  }

  const timeFrac = Math.max(0, 1 - input.elapsedMs / (input.timeLimitSec * 1000));
  let gained = Math.round(SCORING.BASE_POINTS + SCORING.SPEED_BONUS_MAX * timeFrac);

  const streak = input.previousStreak + 1;
  gained +=
    Math.min(streak - 1, SCORING.STREAK_BONUS_MAX_LEVELS) * SCORING.STREAK_BONUS_PER_LEVEL;

  return { gained, streak };
}

/** Điểm tối đa lý thuyết của một câu ở chế độ trực tiếp (trả lời đúng, tức thì). */
export function maxLivePointsForQuestion(): number {
  return (
    SCORING.BASE_POINTS +
    SCORING.SPEED_BONUS_MAX +
    SCORING.STREAK_BONUS_MAX_LEVELS * SCORING.STREAK_BONUS_PER_LEVEL
  );
}

/* ─── Chế độ kiểm tra ──────────────────────────────────────────────────── */

export interface TestGradeItem {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string | null;
}

export interface TestGradeResult {
  correctCount: number;
  totalQuestions: number;
  score: number;
  maxScore: number;
  accuracy: number;
  graded: Array<{ questionId: string; selectedOptionId: string | null; isCorrect: boolean; pointsAwarded: number }>;
}

/**
 * Bài kiểm tra tính 1 điểm mỗi câu — không thưởng tốc độ, vì mục đích là đo
 * mức hiểu bài chứ không phải phản xạ.
 */
export function gradeTest(items: TestGradeItem[]): TestGradeResult {
  const graded = items.map((it) => {
    const isCorrect = it.selectedOptionId !== null && it.selectedOptionId === it.correctOptionId;
    return {
      questionId: it.questionId,
      selectedOptionId: it.selectedOptionId,
      isCorrect,
      pointsAwarded: isCorrect ? 1 : 0,
    };
  });

  const correctCount = graded.filter((g) => g.isCorrect).length;
  const totalQuestions = items.length;

  return {
    correctCount,
    totalQuestions,
    score: correctCount,
    maxScore: totalQuestions,
    accuracy: totalQuestions === 0 ? 0 : correctCount / totalQuestions,
    graded,
  };
}
