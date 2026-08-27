import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PencilRuler, RotateCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { loadLocalQuestions } from "@/lib/local-questions";
import { answerTileStyle } from "@/lib/color";
import { COUNTDOWN_SECONDS, useSoloQuiz } from "@/features/solo/useSoloQuiz";
import { cn } from "@/lib/utils";
import { play, startLoop, stopLoop } from "@/lib/audio";
import { useAudio } from "@/providers/audio-provider";
import { useSoundCue } from "@/hooks/useSoundCue";

/** Số giây cuối mỗi câu có tiếng tích tắc giục. */
const TICK_FROM_SECONDS = 5;

export function SoloQuizPage() {
  // Đọc một lần khi vào trang; trình soạn nằm ở trang khác nên không đổi giữa chừng.
  const [bank] = useState(() => loadLocalQuestions());
  const quiz = useSoloQuiz(bank);
  const { enabled } = useAudio();

  const timePct = useMemo(() => {
    if (!quiz.current || quiz.phase !== "running") return 100;
    return Math.max(0, (quiz.timeLeft / quiz.current.time_limit) * 100);
  }, [quiz.current, quiz.timeLeft, quiz.phase]);

  /*
   * Âm thanh đặt ở đây chứ không nhét vào useSoloQuiz: hook đó đang thuần logic
   * hẹn giờ, trộn thêm âm thanh vào sẽ làm nó khó theo dõi và khó kiểm.
   */
  useSoundCue(
    enabled && quiz.phase === "countdown" && quiz.countdownLeft > 0
      ? `cd-${quiz.index}-${quiz.countdownLeft}`
      : null,
    () => play("countdown", quiz.countdownLeft)
  );

  useSoundCue(
    enabled && quiz.phase === "running" && quiz.timeLeft > 0 && quiz.timeLeft <= TICK_FROM_SECONDS
      ? `tick-${quiz.index}-${quiz.timeLeft}`
      : null,
    // Càng gần hết giờ, tiếng càng đanh.
    () => play("tick", (TICK_FROM_SECONDS - quiz.timeLeft) / (TICK_FROM_SECONDS - 1))
  );

  useSoundCue(
    enabled && quiz.feedback ? `fb-${quiz.index}-${quiz.feedback.kind}` : null,
    () => {
      const kind = quiz.feedback?.kind;
      play(kind === "correct" ? "correct" : kind === "timeout" ? "timeout" : "wrong");
    }
  );

  useSoundCue(enabled && quiz.phase === "finished" ? "done" : null, () => play("podium"));

  // Nhạc nền chỉ chạy trong lúc đang được trả lời.
  useEffect(() => {
    if (!enabled || quiz.phase !== "running") return;
    startLoop("suspense");
    return () => stopLoop("suspense");
  }, [enabled, quiz.phase]);

  if (bank.length === 0) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>Chưa có câu hỏi nào</CardTitle>
          <CardDescription>
            Ngân hàng câu hỏi trong trình duyệt này đang trống. Hãy soạn vài câu trước đã.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/solo/manage">
              <PencilRuler className="size-4" aria-hidden /> Mở trình soạn
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (quiz.phase === "idle") {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>Chơi một mình</CardTitle>
          <CardDescription>{bank.length} câu hỏi sẵn sàng. Đề sẽ được xáo ngẫu nhiên.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="xl" className="w-full" onClick={quiz.start}>
            Bắt đầu chơi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (quiz.phase === "finished") {
    const pct = quiz.total === 0 ? 0 : Math.round((quiz.correctCount / quiz.total) * 100);
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>🎉 Hoàn thành!</CardTitle>
          <CardDescription>
            Đúng {quiz.correctCount} / {quiz.total} câu ({pct}%)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={quiz.start} size="lg">
            <RotateCcw className="size-4" aria-hidden /> Chơi lại
          </Button>
          <Button asChild variant="outline">
            <Link to="/hub">Về trung tâm</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const q = quiz.current;
  if (!q) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <Badge variant="secondary">
          Câu {quiz.index + 1} / {quiz.total}
        </Badge>
        <div className="flex items-center gap-2 font-display text-2xl font-bold tabular-nums">
          <Timer className="size-5 text-muted-foreground" aria-hidden />
          <span aria-live="off">{quiz.phase === "running" ? quiz.timeLeft : q.time_limit}</span>
          <span className="text-sm font-normal text-muted-foreground">giây</span>
        </div>
      </div>

      <Progress
        value={timePct}
        indicatorClassName={cn(
          "transition-[transform] duration-1000 ease-linear",
          timePct <= 25 ? "bg-destructive" : "bg-primary"
        )}
      />

      <Card>
        <CardContent className="p-6">
          <p className="text-center font-display text-xl font-semibold sm:text-2xl">{q.q}</p>
        </CardContent>
      </Card>

      {/*
        Lớp phủ đếm ngược chỉ che lưới đáp án, KHÔNG che câu hỏi — ba giây này
        sinh ra để người chơi kịp đọc đề, phủ kín màn hình là hỏng mục đích.
      */}
      <div className="relative">
        <div
          className={cn(
            "grid gap-3 transition-opacity sm:grid-cols-2",
            quiz.phase === "countdown" && "opacity-40"
          )}
        >
          {q.opts.map((opt, i) => (
            <button
              key={i}
              onClick={() => quiz.answer(i)}
              disabled={quiz.phase !== "running"}
              style={answerTileStyle(opt.color, i)}
              className={cn(
                "min-h-20 rounded-lg px-4 py-4 text-left text-base font-bold shadow-sm transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                quiz.phase === "running" ? "hover:brightness-110" : "cursor-not-allowed",
                quiz.phase !== "running" && quiz.selected !== i && "opacity-60",
                quiz.selected === i && "ring-4 ring-foreground"
              )}
            >
              {opt.text}
            </button>
          ))}
        </div>

        {quiz.phase === "countdown" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            {/* key đổi mỗi giây để hiệu ứng nảy chạy lại cho từng con số. */}
            <span
              key={quiz.countdownLeft}
              aria-hidden
              className="animate-pop font-display text-7xl font-bold text-primary drop-shadow-lg"
            >
              {quiz.countdownLeft}
            </span>
            {/* Đọc "3, 2, 1" ra loa là ồn vô ích — báo một lần rồi thôi. */}
            <span className="sr-only" role="status">
              Câu hỏi sắp bắt đầu, các đáp án sẽ mở khoá sau {COUNTDOWN_SECONDS} giây.
            </span>
          </div>
        )}
      </div>

      <Dialog open={quiz.feedback !== null} onOpenChange={(open) => !open && quiz.next()}>
        <DialogContent className="text-center">
          <DialogTitle
            className={cn(
              "font-display text-2xl",
              quiz.feedback?.kind === "correct" ? "text-success" : "text-destructive"
            )}
          >
            {quiz.feedback?.message}
          </DialogTitle>

          {quiz.feedback && (
            <img
              src={`/${quiz.feedback.image}`}
              alt=""
              className="mx-auto max-h-56 rounded-md object-contain"
            />
          )}

          <div className="space-y-2 text-left text-sm">
            <p>
              <strong>Đáp án đúng:</strong> {quiz.feedback?.correctText}
            </p>
            {quiz.feedback?.explanation && (
              <p className="whitespace-pre-line text-muted-foreground">
                <strong className="text-foreground">Giải thích:</strong> {quiz.feedback.explanation}
              </p>
            )}
          </div>

          <Button onClick={quiz.next} size="lg">
            {quiz.index + 1 >= quiz.total ? "Xem kết quả →" : "Câu tiếp theo →"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
