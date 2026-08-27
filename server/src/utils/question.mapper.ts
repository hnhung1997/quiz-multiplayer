/**
 * Chuyển đổi giữa bản ghi CSDL và dữ liệu gửi ra ngoài.
 *
 * QUAN TRỌNG — bất biến của ứng dụng: đáp án đúng không bao giờ rời máy chủ
 * trước khi câu hỏi kết thúc. `includeAnswer` phải là false ở mọi đường đi mà
 * người xem đang trong lúc làm bài / đang chơi.
 */
import { DEFAULT_ANSWER_COLORS, LIMITS, type OptionDto, type QuestionDto } from "@quiz/shared";
import type { LegacyQuestion } from "@quiz/shared";

interface DbOption {
  id: string;
  position: number;
  text: string;
  color: string | null;
  isCorrect: boolean;
}

interface DbQuestion {
  id: string;
  text: string;
  explanation: string | null;
  imageCorrect: string;
  imageWrong: string;
  timeLimit: number;
  points: number;
  position: number;
  options: DbOption[];
}

export function toOptionDto(o: DbOption, includeAnswer: boolean): OptionDto {
  const dto: OptionDto = {
    id: o.id,
    position: o.position,
    text: o.text,
    color: o.color,
  };
  if (includeAnswer) dto.isCorrect = o.isCorrect;
  return dto;
}

export function toQuestionDto(q: DbQuestion, includeAnswer: boolean): QuestionDto {
  return {
    id: q.id,
    text: q.text,
    explanation: q.explanation,
    imageCorrect: q.imageCorrect,
    imageWrong: q.imageWrong,
    timeLimit: q.timeLimit,
    points: q.points,
    position: q.position,
    options: [...q.options]
      .sort((a, b) => a.position - b.position)
      .map((o) => toOptionDto(o, includeAnswer)),
  };
}

/** Chỉ số của đáp án đúng, dùng cho lớp realtime vốn làm việc theo vị trí. */
export function correctIndexOf(q: DbQuestion): number {
  const sorted = [...q.options].sort((a, b) => a.position - b.position);
  const idx = sorted.findIndex((o) => o.isCorrect);
  return idx >= 0 ? idx : 0;
}

/* ─── Nhập dữ liệu cũ từ localStorage ──────────────────────────────────── */

/**
 * Giá trị nằm trong khoảng thì giữ, ngoài khoảng thì trả về mặc định.
 *
 * Cố ý KHÔNG kẹp về biên: bản cũ (server.js) coi giá trị ngoài khoảng là dữ
 * liệu hỏng và rơi về mặc định. Kẹp về biên sẽ biến `time_limit: 99999` thành
 * 120 giây mỗi câu — gần như chắc chắn không phải ý người dùng.
 */
function inRangeOrDefault(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isInteger(v) || v < min || v > max) return fallback;
  return v;
}

/**
 * Màu cũ có thể là chuỗi '#rrggbb' hoặc chỉ số nguyên vào bảng màu mặc định.
 * Giữ lại cách hiểu đó để không mất màu người dùng đã chọn.
 */
export function colorFromLegacy(value: string | number | null | undefined, index: number): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (typeof value === "number" && Number.isInteger(value) && DEFAULT_ANSWER_COLORS[value]) {
    return DEFAULT_ANSWER_COLORS[value] as string;
  }
  return DEFAULT_ANSWER_COLORS[index % DEFAULT_ANSWER_COLORS.length] as string;
}

export interface NormalizedLegacyQuestion {
  text: string;
  explanation: string | null;
  imageCorrect: string;
  imageWrong: string;
  timeLimit: number;
  options: Array<{ text: string; color: string; isCorrect: boolean }>;
}

/**
 * Bản gộp của ba hàm `normalizeQuestion` từng nằm ở server.js, js.html và
 * host.html. Đây là chỗ duy nhất cắt gọt dữ liệu người dùng gửi lên.
 */
export function normalizeLegacyQuestion(raw: LegacyQuestion): NormalizedLegacyQuestion | null {
  const text = String(raw.q ?? "").trim().slice(0, LIMITS.QUESTION_TEXT_MAX);
  if (!text) return null;

  const options = (raw.opts ?? [])
    .slice(0, LIMITS.OPTIONS_MAX)
    .map((o, i) => ({
      text: String(o?.text ?? "").trim().slice(0, LIMITS.OPTION_TEXT_MAX),
      color: colorFromLegacy(o?.color, i),
      isCorrect: false,
    }))
    .filter((o) => o.text.length > 0);

  if (options.length < LIMITS.OPTIONS_MIN) return null;

  // Chỉ số ngoài phạm vi rơi về 0, giống bản cũ.
  const correct = inRangeOrDefault(raw.a ?? 0, 0, options.length - 1, 0);
  options[correct]!.isCorrect = true;

  const explanation = String(raw.explanation ?? "").trim().slice(0, LIMITS.EXPLANATION_MAX);

  return {
    text,
    explanation: explanation || null,
    imageCorrect: String(raw.img_correct || "dung.jpg").slice(0, 300),
    imageWrong: String(raw.img_wrong || "sai.jpg").slice(0, 300),
    timeLimit: inRangeOrDefault(
      raw.time_limit ?? LIMITS.TIME_LIMIT_DEFAULT,
      LIMITS.TIME_LIMIT_MIN,
      LIMITS.TIME_LIMIT_MAX,
      LIMITS.TIME_LIMIT_DEFAULT
    ),
    options,
  };
}
