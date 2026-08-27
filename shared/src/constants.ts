/**
 * Giới hạn dùng chung cho cả server và client.
 * Đây là ranh giới kiểm soát dữ liệu (security boundary) — trước đây nằm rải rác
 * trong ba bản `normalizeQuestion` khác nhau.
 */
export const LIMITS = {
  QUESTION_TEXT_MAX: 500,
  OPTION_TEXT_MAX: 120,
  EXPLANATION_MAX: 500,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 6,
  TIME_LIMIT_MIN: 4,
  TIME_LIMIT_MAX: 120,
  TIME_LIMIT_DEFAULT: 15,
  PLAYER_NAME_MAX: 24,
  PLAYERS_PER_ROOM_MAX: 200,
  QUIZ_TITLE_MAX: 120,
  DISPLAY_NAME_MAX: 40,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 72, // bcrypt cắt ở 72 byte
} as const;

/** Công thức tính điểm chế độ chơi trực tiếp — giữ nguyên như bản cũ. */
export const SCORING = {
  BASE_POINTS: 500,
  SPEED_BONUS_MAX: 500,
  STREAK_BONUS_PER_LEVEL: 20,
  STREAK_BONUS_MAX_LEVELS: 5, // tối đa +100
  /** Server chốt câu hỏi sau time_limit + khoảng bù trễ mạng này. */
  GRACE_MS: 300,
} as const;

/** Bảng màu mặc định cho các đáp án, khớp bản HTML cũ. */
export const DEFAULT_ANSWER_COLORS = [
  "#e03434",
  "#ff6fcf",
  "#2f9eff",
  "#3fc05f",
  "#ffd24a",
  "#9b6bff",
] as const;

export const ROLES = ["STUDENT", "TEACHER", "ADMIN"] as const;
export const VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export const ATTEMPT_MODES = ["LIVE", "TEST"] as const;

/** Vai trò được phép soạn nội dung và mở phòng chơi. */
export const AUTHOR_ROLES = ["TEACHER", "ADMIN"] as const;
