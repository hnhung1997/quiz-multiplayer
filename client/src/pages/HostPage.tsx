/**
 * Màn hình host, chuyển từ public/host.html.
 * Máy chủ vẫn là nơi quyết định mọi thứ — trang này chỉ hiển thị và ra lệnh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, Play, SkipForward, Square, Trophy } from "lucide-react";
import type {
  NewQuestionEvent,
  QuestionResultEvent,
  QuizSummaryDto,
  WirePlayer,
} from "@quiz/shared";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingBlock } from "@/components/ui/spinner";
import { answerTileStyle } from "@/lib/color";
import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils";
import { play, startLoop, stopLoop } from "@/lib/audio";
import { useAudio } from "@/providers/audio-provider";

type Step = "pick" | "lobby" | "question" | "reveal" | "final";

export function HostPage() {
  const { socket, connected } = useSocket();
  const [params] = useSearchParams();
  const preselect = params.get("quiz");

  const [step, setStep] = useState<Step>("pick");
  const [pin, setPin] = useState<string | null>(null);
  const [players, setPlayers] = useState<WirePlayer[]>([]);
  const [question, setQuestion] = useState<NewQuestionEvent | null>(null);
  const [result, setResult] = useState<QuestionResultEvent | null>(null);
  const [progress, setProgress] = useState({ answered: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { secondsLeft, pct, start: startCountdown, stop: stopCountdown } = useCountdown();
  const { enabled: soundOn } = useAudio();
  /** So sánh sĩ số cũ/mới để chỉ kêu khi có người vào, không kêu khi có người rớt. */
  const prevPlayerCount = useRef(0);

  const quizzesQuery = useQuery({
    queryKey: ["quizzes", "hostable"],
    queryFn: async () => {
      const [mine, pub] = await Promise.all([
        api.get<{ quizzes: QuizSummaryDto[] }>("/api/quizzes?scope=mine"),
        api.get<{ quizzes: QuizSummaryDto[] }>("/api/quizzes?scope=public"),
      ]);
      const seen = new Set<string>();
      return [...mine.quizzes, ...pub.quizzes].filter((q) => {
        if (seen.has(q.id) || q.questionCount === 0) return false;
        seen.add(q.id);
        return true;
      });
    },
  });

  useEffect(() => {
    if (!socket) return;

    const onPlayers = (list: WirePlayer[]) => {
      // Chỉ kêu khi có người MỚI vào, không kêu lúc có người rớt ra.
      if (list.length > prevPlayerCount.current) play("join");
      prevPlayerCount.current = list.length;
      setPlayers(list);
    };
    const onNewQuestion = (e: NewQuestionEvent) => {
      setQuestion(e);
      setResult(null);
      setProgress({ answered: 0, total: players.length });
      setStep("question");
      startCountdown(e.time_limit);
    };
    const onProgress = (e: { answered: number; total: number }) => setProgress(e);
    const onResult = (e: QuestionResultEvent) => {
      stopCountdown();
      play("reveal");
      setResult(e);
      setStep("reveal");
    };
    const onLeaderboard = (list: WirePlayer[]) => setPlayers(list);
    const onFinished = (list: WirePlayer[]) => {
      stopCountdown();
      play("podium");
      setPlayers(list);
      setStep("final");
    };

    socket.on("players_update", onPlayers);
    socket.on("new_question", onNewQuestion);
    socket.on("answers_progress", onProgress);
    socket.on("question_result", onResult);
    socket.on("leaderboard_updated", onLeaderboard);
    socket.on("game_finished", onFinished);

    return () => {
      socket.off("players_update", onPlayers);
      socket.off("new_question", onNewQuestion);
      socket.off("answers_progress", onProgress);
      socket.off("question_result", onResult);
      socket.off("leaderboard_updated", onLeaderboard);
      socket.off("game_finished", onFinished);
    };
  }, [socket, players.length, startCountdown, stopCountdown]);

  /*
   * Nhạc nền theo từng chặng: phòng chờ thì thư thái, đang trả lời thì dồn dập.
   * Cleanup của effect lo việc tắt, nên chuyển chặng là nhạc tự đổi.
   */
  useEffect(() => {
    if (!soundOn) return;
    const loop = step === "lobby" ? "lobby" : step === "question" ? "suspense" : null;
    if (!loop) return;
    startLoop(loop);
    return () => stopLoop(loop);
  }, [soundOn, step]);

  const createRoom = useCallback(
    (quizId: string) => {
      if (!socket) return;
      setBusy(true);
      setError(null);
      socket.emit("create_room", { quizId }, (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setPin(res.data.pin);
        setStep("lobby");
      });
    },
    [socket]
  );

  useEffect(() => {
    if (preselect && step === "pick" && connected && quizzesQuery.data) {
      const found = quizzesQuery.data.find((q) => q.id === preselect);
      if (found) createRoom(found.id);
    }
  }, [preselect, step, connected, quizzesQuery.data, createRoom]);

  const joinUrl = useMemo(
    () => (pin ? `${window.location.origin}/play?pin=${pin}` : ""),
    [pin]
  );

  if (!connected) return <LoadingBlock label="Đang kết nối máy chủ..." />;

  /* ─── Chọn bộ quiz ─────────────────────────────────────────────────────── */
  if (step === "pick") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Mở phòng chơi nhóm</h1>
          <p className="mt-1 text-muted-foreground">Chọn một bộ quiz để bắt đầu.</p>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {quizzesQuery.isLoading ? (
          <LoadingBlock />
        ) : (quizzesQuery.data?.length ?? 0) === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Chưa có bộ quiz nào có câu hỏi. Hãy tạo một bộ trước.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzesQuery.data?.map((q) => (
              <Card key={q.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">{q.title}</CardTitle>
                  <CardDescription>{q.questionCount} câu hỏi</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button className="w-full" onClick={() => createRoom(q.id)} disabled={busy}>
                    <Play className="size-4" aria-hidden /> Mở phòng
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─── Phòng chờ ────────────────────────────────────────────────────────── */
  if (step === "lobby") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-widest">Mã PIN tham gia</CardDescription>
            <p className="font-display text-6xl font-bold tracking-[0.2em] text-primary">{pin}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Người chơi vào địa chỉ này và nhập mã PIN:</p>
            <div className="flex items-center justify-center gap-2">
              <code className="rounded bg-muted px-3 py-1.5 text-sm">{joinUrl}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void navigator.clipboard?.writeText(joinUrl)}
                aria-label="Sao chép đường dẫn"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{players.length} người đã tham gia</CardTitle>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-muted-foreground">Chưa có ai tham gia...</p>
            ) : (
              <ul className="flex flex-wrap justify-center gap-2">
                {players.map((p) => (
                  <li key={p.id} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">
                    {p.name}
                    {!p.userId && (
                      <span className="ml-1 text-xs text-muted-foreground" title="Khách chơi">
                        (khách)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Button
          size="xl"
          className="w-full"
          disabled={players.length === 0}
          onClick={() => socket?.emit("start_game")}
        >
          <Play className="size-5" aria-hidden /> Bắt đầu trận đấu
        </Button>
      </div>
    );
  }

  /* ─── Đang hỏi ─────────────────────────────────────────────────────────── */
  if (step === "question" && question) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            Câu {question.index + 1} / {question.total}
          </Badge>
          <span className="font-display text-2xl font-bold tabular-nums">{secondsLeft}s</span>
        </div>

        <Progress value={pct} indicatorClassName="transition-[transform] duration-1000 ease-linear" />

        <Card>
          <CardContent className="p-6">
            <p className="text-center font-display text-2xl font-semibold">{question.q}</p>
          </CardContent>
        </Card>

        <p className="text-center font-semibold text-primary">
          {progress.answered} / {progress.total} người đã trả lời
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {question.opts.map((o, i) => (
            <div
              key={i}
              style={answerTileStyle(o.color, i)}
              className="rounded-lg px-4 py-4 font-bold shadow-sm"
            >
              {o.text}
            </div>
          ))}
        </div>

        <Button variant="secondary" className="w-full" onClick={() => socket?.emit("next_question_force_reveal")}>
          Xem kết quả ngay
        </Button>
      </div>
    );
  }

  /* ─── Công bố kết quả ──────────────────────────────────────────────────── */
  if (step === "reveal" && result && question) {
    const counts = new Map<number, number>();
    for (const r of result.results) {
      if (r.chosen !== null) counts.set(r.chosen, (counts.get(r.chosen) ?? 0) + 1);
    }

    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-center font-display text-2xl font-bold">Kết quả câu hỏi</h1>

        <Card>
          <CardContent className="p-6">
            <p className="text-center font-display text-xl font-semibold">{question.q}</p>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {question.opts.map((o, i) => (
            <div
              key={i}
              style={answerTileStyle(o.color, i)}
              className={cn(
                "flex items-center justify-between rounded-lg px-4 py-4 font-bold shadow-sm",
                i === result.correctIndex ? "ring-4 ring-success" : "opacity-70"
              )}
            >
              <span>
                {o.text} {i === result.correctIndex && "✅"}
              </span>
              <span>{counts.get(i) ?? 0}</span>
            </div>
          ))}
        </div>

        {result.explanation && (
          <Card>
            <CardContent className="p-4 text-sm">
              <strong>Giải thích:</strong> {result.explanation}
            </CardContent>
          </Card>
        )}

        <Leaderboard players={players} />

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => socket?.emit("next_question")}>
            <SkipForward className="size-4" aria-hidden /> Câu tiếp theo
          </Button>
          <Button variant="destructive" onClick={() => socket?.emit("end_game")}>
            <Square className="size-4" aria-hidden /> Kết thúc
          </Button>
        </div>
      </div>
    );
  }

  /* ─── Kết thúc ─────────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <h1 className="font-display text-3xl font-bold">🎉 Kết thúc trận đấu</h1>
      <div className="space-y-2">
        {players.slice(0, 3).map((p, i) => (
          <p key={p.id} className="font-display text-xl">
            {["🥇", "🥈", "🥉"][i]} <strong>{p.name}</strong> — {p.score} điểm
          </p>
        ))}
      </div>
      <Leaderboard players={players} />
      <Button onClick={() => window.location.reload()}>Tạo phòng mới</Button>
    </div>
  );
}

function Leaderboard({ players }: { players: WirePlayer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-5 text-warning" aria-hidden /> Bảng xếp hạng
        </CardTitle>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có ai.</p>
        ) : (
          <ol className="space-y-2">
            {players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md bg-secondary/50 px-3 py-2">
                <span className="w-8 text-sm text-muted-foreground">
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                </span>
                <span className="flex-1 text-left font-medium">{p.name}</span>
                <span className="font-semibold tabular-nums">{p.score}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
