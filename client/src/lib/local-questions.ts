/**
 * Ngân hàng câu hỏi lưu trong trình duyệt — vẫn dùng đúng khoá
 * localStorage['pr_quiz_questions'] của bản cũ, nên dữ liệu người dùng đã soạn
 * trước đây không mất và có thể nhập lên máy chủ sau.
 */
import { DEFAULT_ANSWER_COLORS, LIMITS } from "@quiz/shared";

export const LOCAL_QUESTIONS_KEY = "pr_quiz_questions";
export const LOCAL_NAMES_KEY = "pr_names";

export interface LocalOption {
  text: string;
  color: string;
}

export interface LocalQuestion {
  q: string;
  opts: LocalOption[];
  a: number;
  explanation: string;
  img_correct: string;
  img_wrong: string;
  time_limit: number;
}

function colorFromLegacy(value: unknown, index: number): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (typeof value === "number" && Number.isInteger(value) && DEFAULT_ANSWER_COLORS[value]) {
    return DEFAULT_ANSWER_COLORS[value] as string;
  }
  return DEFAULT_ANSWER_COLORS[index % DEFAULT_ANSWER_COLORS.length] as string;
}

/** Dữ liệu cũ có thể thiếu trường, nên chuẩn hoá mọi câu khi đọc lên. */
export function normalizeLocalQuestion(raw: unknown): LocalQuestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const q = String(r.q ?? "").trim();
  if (!q) return null;

  const rawOpts = Array.isArray(r.opts) ? r.opts : [];
  const opts: LocalOption[] = rawOpts
    .slice(0, LIMITS.OPTIONS_MAX)
    .map((o, i) => {
      const item = (typeof o === "object" && o !== null ? o : {}) as Record<string, unknown>;
      return {
        text: String(item.text ?? "").trim().slice(0, LIMITS.OPTION_TEXT_MAX),
        color: colorFromLegacy(item.color, i),
      };
    })
    .filter((o) => o.text.length > 0);

  if (opts.length < LIMITS.OPTIONS_MIN) return null;

  const aRaw = Number(r.a);
  const a = Number.isInteger(aRaw) && aRaw >= 0 && aRaw < opts.length ? aRaw : 0;

  const tRaw = Number(r.time_limit);
  const time_limit =
    Number.isInteger(tRaw) && tRaw >= LIMITS.TIME_LIMIT_MIN && tRaw <= LIMITS.TIME_LIMIT_MAX
      ? tRaw
      : LIMITS.TIME_LIMIT_DEFAULT;

  return {
    q: q.slice(0, LIMITS.QUESTION_TEXT_MAX),
    opts,
    a,
    explanation: String(r.explanation ?? "").slice(0, LIMITS.EXPLANATION_MAX),
    img_correct: String(r.img_correct || "dung.jpg"),
    img_wrong: String(r.img_wrong || "sai.jpg"),
    time_limit,
  };
}

export function loadLocalQuestions(): LocalQuestion[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_QUESTIONS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeLocalQuestion)
      .filter((q): q is LocalQuestion => q !== null);
  } catch {
    return [];
  }
}

export function saveLocalQuestions(questions: LocalQuestion[]): void {
  try {
    localStorage.setItem(LOCAL_QUESTIONS_KEY, JSON.stringify(questions));
  } catch {
    // Hết dung lượng hoặc bị chặn — không làm sập giao diện vì chuyện này.
  }
}

export function loadLocalNames(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_NAMES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveLocalNames(names: string[]): void {
  try {
    localStorage.setItem(LOCAL_NAMES_KEY, JSON.stringify(names));
  } catch {
    // như trên
  }
}
