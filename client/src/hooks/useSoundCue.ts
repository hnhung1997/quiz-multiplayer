import { useEffect, useRef } from "react";

/**
 * Phát một tiếng mỗi khi `key` đổi sang giá trị mới.
 *
 * Vì sao cần hook riêng: <StrictMode> chạy effect hai lần ở chế độ dev, nên đặt
 * `play(...)` thẳng trong useEffect sẽ nghe kêu đôi. `useRef` sống sót qua cặp
 * chạy đó nên lần thứ hai bị chặn lại.
 *
 * `key` bằng null nghĩa là "chưa tới lúc" — đồng thời xoá dấu vết để lần sau
 * quay lại đúng giá trị cũ vẫn kêu (ví dụ câu hỏi mới lại đếm ngược từ 3).
 */
export function useSoundCue(key: string | number | null, fire: () => void): void {
  const last = useRef<string | number | null>(null);

  // Cố ý không truyền mảng phụ thuộc: hook chạy mỗi lần render và tự chặn lặp
  // bằng ref, nhờ vậy không phụ thuộc vào việc `fire` có ổn định hay không.
  useEffect(() => {
    if (key === null) {
      last.current = null;
      return;
    }
    if (last.current === key) return;
    last.current = key;
    fire();
  });
}
