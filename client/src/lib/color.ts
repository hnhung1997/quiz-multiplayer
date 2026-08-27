/**
 * Xử lý màu đáp án.
 *
 * `getContrastTextColor` được bê từ public/player.html của bản cũ — người soạn
 * câu hỏi được tự chọn màu nền bất kỳ, nên vẫn phải tính độ tương phản lúc chạy
 * chứ không thể chốt cứng trong bảng token.
 */

/** Sáu biến CSS ứng với sáu ô đáp án, đổi giá trị theo sáng/tối. */
const ANSWER_VARS = [
  "var(--answer-1)",
  "var(--answer-2)",
  "var(--answer-3)",
  "var(--answer-4)",
  "var(--answer-5)",
  "var(--answer-6)",
] as const;

export function answerColorAt(index: number): string {
  return ANSWER_VARS[index % ANSWER_VARS.length] as string;
}

/** Màu do người soạn chọn nếu hợp lệ, nếu không thì lấy màu theo vị trí. */
export function resolveAnswerColor(color: string | null | undefined, index: number): string {
  if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return answerColorAt(index);
}

/**
 * Chọn màu chữ đen hay trắng cho dễ đọc trên nền đã cho.
 * Ngưỡng 0.62 giữ nguyên như bản cũ để các câu hỏi cũ trông không đổi.
 */
export function getContrastTextColor(hex: string): string {
  const clean = String(hex ?? "#ffffff").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#ffffff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#222222" : "#ffffff";
}

/**
 * Style cho một ô đáp án. Màu tuỳ chọn thì tính tương phản; màu theo bộ token
 * thì để CSS lo, vì giá trị đổi theo chế độ sáng/tối.
 */
export function answerTileStyle(
  color: string | null | undefined,
  index: number
): React.CSSProperties {
  const isCustom = typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color);
  if (isCustom) {
    return { backgroundColor: color, color: getContrastTextColor(color) };
  }
  return { backgroundColor: answerColorAt(index), color: "#ffffff" };
}
