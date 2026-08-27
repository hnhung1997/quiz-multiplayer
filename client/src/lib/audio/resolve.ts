/**
 * Chọn nguồn âm: dùng tệp người dùng cung cấp hay tự tổng hợp.
 *
 * Tệp này CỐ Ý không import gì và không đụng tới Web Audio — nhờ vậy chạy được
 * dưới `node --test` (Node không có AudioContext), và đây cũng là phần duy nhất
 * của hệ thống âm thanh kiểm tự động được.
 */

export const SOUND_NAMES = [
  "countdown",
  "tick",
  "correct",
  "wrong",
  "timeout",
  "join",
  "reveal",
  "podium",
  "lobby",
  "suspense",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

/** Hai âm nền chạy lặp, phần còn lại kêu một tiếng rồi thôi. */
export const LOOP_NAMES = ["lobby", "suspense"] as const;
export type LoopName = (typeof LOOP_NAMES)[number];

export const SOUNDS_BASE = "/sounds/";

export type SoundSource = { kind: "file"; url: string } | { kind: "synth" };

export type SoundManifest = Partial<Record<SoundName, string>>;

export function isSoundName(value: unknown): value is SoundName {
  return typeof value === "string" && (SOUND_NAMES as readonly string[]).includes(value);
}

export function isLoopName(value: unknown): value is LoopName {
  return typeof value === "string" && (LOOP_NAMES as readonly string[]).includes(value);
}

/**
 * Tên tệp phải là tên trơn nằm trong `public/sounds/`.
 * Chặn đường dẫn tuyệt đối, thư mục cha và URL ngoài — manifest là dữ liệu
 * người dùng tự sửa, không nên để nó trỏ ra ngoài thư mục âm thanh.
 */
function isSafeFileName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const name = value.trim();
  if (name.length === 0 || name.length > 200) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.includes("..")) return false;
  if (name.startsWith(".")) return false;
  return true;
}

/**
 * Đọc manifest thành dạng dùng được. Dữ liệu hỏng thì bỏ qua chứ không ném lỗi:
 * mất nhạc còn hơn vỡ cả trang chỉ vì một tệp JSON sai cú pháp.
 */
export function parseManifest(raw: unknown): SoundManifest {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

  const out: SoundManifest = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSoundName(key)) continue;
    if (!isSafeFileName(value)) continue;
    out[key] = value.trim();
  }
  return out;
}

/** Có khai báo trong manifest thì dùng tệp, không thì tổng hợp. */
export function resolveSource(name: SoundName, manifest: SoundManifest): SoundSource {
  const file = manifest[name];
  if (file) return { kind: "file", url: SOUNDS_BASE + file };
  return { kind: "synth" };
}
