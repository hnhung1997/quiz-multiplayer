import { z } from "zod";
import { LIMITS, ROLES, VISIBILITIES } from "./constants.ts";

/**
 * Thông báo lỗi mặc định bằng tiếng Việt — toàn bộ giao diện dùng tiếng Việt,
 * nên "Required" của zod lọt ra ngoài trông rất lạc lõng.
 */
z.setErrorMap((issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.received === "undefined" || issue.received === "null") {
      return { message: "Thiếu thông tin bắt buộc." };
    }
    return { message: "Kiểu dữ liệu không hợp lệ." };
  }
  if (issue.code === z.ZodIssueCode.too_small && issue.type === "string") {
    return { message: `Cần ít nhất ${issue.minimum} ký tự.` };
  }
  if (issue.code === z.ZodIssueCode.too_big && issue.type === "string") {
    return { message: `Tối đa ${issue.maximum} ký tự.` };
  }
  if (issue.code === z.ZodIssueCode.invalid_string && issue.validation === "email") {
    return { message: "Email không hợp lệ." };
  }
  return { message: ctx.defaultError };
});

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/* ─── Auth ─────────────────────────────────────────────────────────────── */

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ."),
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập cần ít nhất 3 ký tự.")
    .max(24)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Tên đăng nhập chỉ gồm chữ, số, dấu . _ -"),
  password: z
    .string()
    .min(LIMITS.PASSWORD_MIN, `Mật khẩu cần ít nhất ${LIMITS.PASSWORD_MIN} ký tự.`)
    .max(LIMITS.PASSWORD_MAX),
  displayName: trimmed(LIMITS.DISPLAY_NAME_MAX),
});

export const loginSchema = z.object({
  /** Cho phép đăng nhập bằng email hoặc tên đăng nhập. */
  identifier: z.string().trim().min(1, "Nhập email hoặc tên đăng nhập."),
  password: z.string().min(1, "Nhập mật khẩu."),
});

/* ─── Câu hỏi ──────────────────────────────────────────────────────────── */

export const optionSchema = z.object({
  text: trimmed(LIMITS.OPTION_TEXT_MAX),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Màu phải dạng #rrggbb.")
    .nullish(),
  isCorrect: z.boolean().default(false),
});

export const questionInputSchema = z
  .object({
    text: trimmed(LIMITS.QUESTION_TEXT_MAX),
    explanation: z.string().trim().max(LIMITS.EXPLANATION_MAX).nullish(),
    imageCorrect: z.string().trim().max(300).default("dung.jpg"),
    imageWrong: z.string().trim().max(300).default("sai.jpg"),
    timeLimit: z
      .number()
      .int()
      .min(LIMITS.TIME_LIMIT_MIN)
      .max(LIMITS.TIME_LIMIT_MAX)
      .default(LIMITS.TIME_LIMIT_DEFAULT),
    points: z.number().int().min(0).max(10000).default(1000),
    options: z.array(optionSchema).min(LIMITS.OPTIONS_MIN).max(LIMITS.OPTIONS_MAX),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: "Cần chọn đúng một đáp án đúng.",
    path: ["options"],
  });

/* ─── Ngân hàng câu hỏi & bộ quiz ──────────────────────────────────────── */

export const bankInputSchema = z.object({
  title: trimmed(LIMITS.QUIZ_TITLE_MAX),
  description: z.string().trim().max(500).nullish(),
  visibility: z.enum(VISIBILITIES).default("PRIVATE"),
});

export const quizInputSchema = z.object({
  title: trimmed(LIMITS.QUIZ_TITLE_MAX),
  description: z.string().trim().max(1000).nullish(),
  coverImage: z.string().trim().max(300).nullish(),
  visibility: z.enum(VISIBILITIES).default("PRIVATE"),
  isPublished: z.boolean().default(false),
  allowTestMode: z.boolean().default(true),
  defaultTimeLimit: z
    .number()
    .int()
    .min(LIMITS.TIME_LIMIT_MIN)
    .max(LIMITS.TIME_LIMIT_MAX)
    .default(LIMITS.TIME_LIMIT_DEFAULT),
});

export const quizQuestionOrderSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

/* ─── Nhập dữ liệu từ localStorage bản cũ ──────────────────────────────── */

/**
 * Đúng hình dạng đang nằm trong localStorage['pr_quiz_questions'].
 * Nới lỏng có chủ ý: dữ liệu cũ có thể thiếu trường hoặc dùng màu dạng số.
 */
export const legacyQuestionSchema = z.object({
  q: z.string().trim().min(1),
  opts: z
    .array(
      z.object({
        text: z.string().default(""),
        color: z.union([z.string(), z.number()]).nullish(),
      })
    )
    .min(1),
  a: z.number().int().min(0).default(0),
  explanation: z.string().nullish(),
  img_correct: z.string().nullish(),
  img_wrong: z.string().nullish(),
  time_limit: z.number().int().nullish(),
});

export const legacyImportSchema = z.object({
  bankTitle: trimmed(LIMITS.QUIZ_TITLE_MAX).default("Câu hỏi nhập từ trình duyệt"),
  createQuiz: z.boolean().default(true),
  questions: z.array(legacyQuestionSchema).min(1, "Không có câu hỏi nào để nhập."),
});

/* ─── Chế độ kiểm tra ──────────────────────────────────────────────────── */

export const startAttemptSchema = z.object({
  quizId: z.string().uuid(),
});

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        optionId: z.string().uuid().nullable(),
      })
    )
    .max(500),
});

/* ─── Quản trị ─────────────────────────────────────────────────────────── */

export const updateUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  displayName: trimmed(LIMITS.DISPLAY_NAME_MAX).optional(),
});

/* ─── Realtime ─────────────────────────────────────────────────────────── */

export const joinRoomSchema = z.object({
  pin: z.string().trim().regex(/^\d{6}$/, "Mã PIN gồm 6 chữ số."),
  name: trimmed(LIMITS.PLAYER_NAME_MAX),
});

export const createRoomSchema = z.object({
  quizId: z.string().uuid(),
});

export const submitAnswerSchema = z.object({
  idx: z.number().int().min(0).max(LIMITS.OPTIONS_MAX - 1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type BankInput = z.infer<typeof bankInputSchema>;
export type QuizInput = z.infer<typeof quizInputSchema>;
export type LegacyQuestion = z.infer<typeof legacyQuestionSchema>;
export type LegacyImportInput = z.infer<typeof legacyImportSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
