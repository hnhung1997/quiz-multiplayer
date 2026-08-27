/**
 * Vòng chơi một mình, chuyển từ js.html (dòng 1429–1570).
 *
 * Bản cũ bắt bấm thêm nút "bắt đầu tính giờ" sau khi câu hỏi hiện ra. Nay bỏ
 * bước đó: câu hỏi hiện ra là tự đếm ngược 3 giây cho người chơi kịp đọc đề,
 * rồi đồng hồ chạy và mở khoá đáp án — không phải bấm gì thêm.
 *
 * Toàn bộ việc hẹn giờ nằm trong useEffect chứ không gọi thẳng từ hàm xử lý sự
 * kiện: `start()` đặt câu hỏi và chỉ số ở cùng một lần render, nên `current`
 * chỉ tươi ở lần render sau. Effect đọc đúng giá trị của lần render nó chạy.
 */
import { useCallback, useEffect, useState } from "react";
import type { LocalQuestion } from "@/lib/local-questions";

/** Số giây chờ đọc đề trước khi đồng hồ bắt đầu chạy. */
export const COUNTDOWN_SECONDS = 3;

export type SoloPhase = "idle" | "countdown" | "running" | "feedback" | "finished";

export interface SoloFeedback {
  kind: "correct" | "wrong" | "timeout";
  message: string;
  image: string;
  correctText: string;
  explanation: string;
}

const MESSAGES = {
  correct: "CHÍNH XÁC! Tuyệt vời!",
  wrong: "Ê NHAAAAAAAA!",
  timeout: "HẾT GIỜ RỒI!!!! 💀",
} as const;

export function useSoloQuiz(source: LocalQuestion[]) {
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<SoloPhase>("idle");
  const [countdownLeft, setCountdownLeft] = useState(COUNTDOWN_SECONDS);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<SoloFeedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const current = questions[index];

  const buildFeedback = useCallback(
    (q: LocalQuestion, kind: SoloFeedback["kind"]): SoloFeedback => ({
      kind,
      message: MESSAGES[kind],
      image: kind === "correct" ? q.img_correct : kind === "timeout" ? "hetgio.jpg" : q.img_wrong,
      correctText: q.opts[q.a]?.text ?? "",
      explanation: q.explanation.trim(),
    }),
    []
  );

  /*
   * Đếm ngược 3 · 2 · 1 rồi tự chuyển sang chạy giờ.
   *
   * `remaining` là biến cục bộ của mỗi lần chạy effect, không phải state:
   * <StrictMode> gọi effect hai lần ở chế độ dev, mỗi lần có biến đếm và
   * interval riêng, và cleanup xoá đúng interval của lần đó nên đồng hồ không
   * bị chạy nhanh gấp đôi.
   */
  useEffect(() => {
    if (phase !== "countdown" || !current) return;

    let remaining = COUNTDOWN_SECONDS;
    setCountdownLeft(remaining);

    const id = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(id);
        setCountdownLeft(0);
        setPhase("running");
      } else {
        setCountdownLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [phase, index, current]);

  /** Đồng hồ của câu hỏi. Hết giờ thì tự sang màn phản hồi. */
  useEffect(() => {
    if (phase !== "running" || !current) return;

    let remaining = current.time_limit;
    setTimeLeft(remaining);

    const id = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(id);
        setTimeLeft(0);
        setPhase("feedback");
        setFeedback(buildFeedback(current, "timeout"));
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [phase, index, current, buildFeedback]);

  const start = useCallback(() => {
    if (source.length === 0) return;
    // Xáo đề mỗi ván, giống bản cũ.
    setQuestions([...source].sort(() => Math.random() - 0.5));
    setIndex(0);
    setSelected(null);
    setFeedback(null);
    setCorrectCount(0);
    setPhase("countdown");
  }, [source]);

  const answer = useCallback(
    (optionIndex: number) => {
      if (!current || phase !== "running") return;
      setSelected(optionIndex);
      const isCorrect = optionIndex === current.a;
      if (isCorrect) setCorrectCount((c) => c + 1);
      // Đổi pha là đủ — cleanup của effect sẽ dừng đồng hồ.
      setPhase("feedback");
      setFeedback(buildFeedback(current, isCorrect ? "correct" : "wrong"));
    },
    [current, phase, buildFeedback]
  );

  const next = useCallback(() => {
    setSelected(null);
    setFeedback(null);
    if (index + 1 >= questions.length) {
      setPhase("finished");
      return;
    }
    setIndex((i) => i + 1);
    setPhase("countdown");
  }, [index, questions.length]);

  const reset = useCallback(() => {
    setPhase("idle");
    setQuestions([]);
    setIndex(0);
    setSelected(null);
    setFeedback(null);
    setCorrectCount(0);
  }, []);

  return {
    phase,
    current,
    index,
    total: questions.length,
    countdownLeft,
    timeLeft,
    selected,
    feedback,
    correctCount,
    start,
    answer,
    next,
    reset,
  };
}
