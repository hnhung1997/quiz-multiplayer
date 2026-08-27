import type { ROLES, VISIBILITIES, ATTEMPT_MODES } from "./constants.ts";

export type Role = (typeof ROLES)[number];
export type Visibility = (typeof VISIBILITIES)[number];
export type AttemptMode = (typeof ATTEMPT_MODES)[number];

/* ─── DTO ──────────────────────────────────────────────────────────────── */

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface OptionDto {
  id: string;
  position: number;
  text: string;
  color: string | null;
  /** CHỈ có mặt khi người xem là chủ sở hữu / admin, hoặc khi câu hỏi đã kết thúc. */
  isCorrect?: boolean;
}

export interface QuestionDto {
  id: string;
  text: string;
  explanation: string | null;
  imageCorrect: string;
  imageWrong: string;
  timeLimit: number;
  points: number;
  position: number;
  options: OptionDto[];
}

export interface QuizSummaryDto {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  visibility: Visibility;
  isPublished: boolean;
  allowTestMode: boolean;
  questionCount: number;
  owner: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface QuizDetailDto extends QuizSummaryDto {
  questions: QuestionDto[];
}

export interface BankSummaryDto {
  id: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  questionCount: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Kết quả & phân tích ──────────────────────────────────────────────── */

export interface AttemptSummaryDto {
  id: string;
  quizId: string;
  quizTitle: string;
  mode: AttemptMode;
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number; // 0..1
  rank: number | null;
  durationMs: number | null;
  submittedAt: string | null;
}

export interface AttemptReviewItemDto {
  questionId: string;
  questionText: string;
  explanation: string | null;
  options: Array<OptionDto & { isCorrect: boolean }>;
  selectedOptionId: string | null;
  isCorrect: boolean;
  pointsAwarded: number;
  elapsedMs: number | null;
}

export interface AttemptReviewDto extends AttemptSummaryDto {
  items: AttemptReviewItemDto[];
}

export interface QuizAnalyticsDto {
  quizId: string;
  quizTitle: string;
  attemptCount: number;
  averageScorePct: number;
  questions: Array<{
    questionId: string;
    questionText: string;
    answeredCount: number;
    correctCount: number;
    correctPct: number;
    /** Phân bố lựa chọn, để thấy đáp án nhiễu nào đang đánh lừa học sinh. */
    distribution: Array<{ optionId: string; text: string; count: number; isCorrect: boolean }>;
  }>;
}

export interface MeStatsDto {
  totalAttempts: number;
  liveAttempts: number;
  testAttempts: number;
  averageAccuracy: number;
  bestScore: number;
  recent: AttemptSummaryDto[];
}

/* ─── Realtime ─────────────────────────────────────────────────────────── */
/*
 * Tên trường giữ nguyên như bản cũ (q, opts, a, time_limit) để không phá vỡ
 * các trang HTML đang chạy trong lúc chuyển dần sang React.
 */

export interface WirePlayer {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  /** null nếu là khách chơi không đăng nhập. */
  userId: string | null;
}

export interface NewQuestionEvent {
  index: number;
  total: number;
  q: string;
  opts: Array<{ text: string; color: string | null }>;
  time_limit: number;
  /** Không bao giờ chứa đáp án đúng — xem question_result. */
}

export interface QuestionResultEvent {
  correctIndex: number;
  explanation: string | null;
  img_correct: string;
  img_wrong: string;
  results: Array<{
    id: string;
    name: string;
    correct: boolean;
    gained: number;
    score: number;
    chosen: number | null;
  }>;
}

export interface AckOk<T = Record<string, never>> {
  ok: true;
  data: T;
}
export interface AckErr {
  ok: false;
  error: string;
}
export type Ack<T = Record<string, never>> = AckOk<T> | AckErr;

/** Client → server */
export interface ClientToServerEvents {
  create_room: (
    payload: { quizId: string },
    cb: (res: Ack<{ pin: string; totalQuestions: number; quizTitle: string }>) => void
  ) => void;
  join_room: (
    payload: { pin: string; name: string },
    cb: (res: Ack<{ pin: string; quizTitle: string }>) => void
  ) => void;
  start_game: () => void;
  next_question: () => void;
  next_question_force_reveal: () => void;
  end_game: () => void;
  submit_answer: (payload: { idx: number }) => void;
  leave_room: () => void;
}

/** Server → client */
export interface ServerToClientEvents {
  new_question: (e: NewQuestionEvent) => void;
  question_result: (e: QuestionResultEvent) => void;
  answers_progress: (e: { answered: number; total: number }) => void;
  leaderboard_updated: (players: WirePlayer[]) => void;
  players_update: (players: WirePlayer[]) => void;
  game_started: () => void;
  game_finished: (players: WirePlayer[]) => void;
  answer_submitted: () => void;
  host_left: () => void;
  room_error: (e: { message: string }) => void;
}
