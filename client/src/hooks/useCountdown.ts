/**
 * Đồng hồ đếm ngược cho phần hiển thị.
 *
 * CHỈ là hiệu ứng. Hạn chót thật nằm ở `setTimeout` phía máy chủ — nếu máy
 * client chạy lệch giờ hoặc bị ngủ, máy chủ vẫn chốt câu đúng lúc.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [total, setTotal] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(
    (seconds: number) => {
      stop();
      setTotal(seconds);
      setSecondsLeft(seconds);
      timer.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            stop();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [stop]
  );

  useEffect(() => stop, [stop]);

  return {
    secondsLeft,
    total,
    pct: total === 0 ? 0 : (secondsLeft / total) * 100,
    start,
    stop,
  };
}
