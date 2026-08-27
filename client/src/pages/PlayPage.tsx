/**
 * Màn hình người chơi, chuyển từ public/player.html.
 *
 * Khác một điểm so với bản cũ: bản cũ dò kết quả của chính mình theo TÊN, nên
 * quy tắc "tên không trùng nhau" mới thành bắt buộc. Ở đây dùng socket.id —
 * máy chủ vốn đã gửi kèm — nên việc dò luôn chính xác.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LIMITS, type NewQuestionEvent, type QuestionResultEvent, type WirePlayer } from "@quiz/shared";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingBlock } from "@/components/ui/spinner";
import { answerTileStyle } from "@/lib/color";
import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils";
import { play } from "@/lib/audio";
import { useAudio } from "@/providers/audio-provider";
import { useSoundCue } from "@/hooks/useSoundCue";

/** Số giây cuối mỗi câu có tiếng tích tắc giục. */
const TICK_FROM_SECONDS = 5;

type Step = "join" | "waiting" | "question" | "result" | "final";

interface MyResult {
  correct: boolean;
  gained: number;
  score: number;
  answered: boolean;
}

export function PlayPage() {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [params] = useSearchParams();

  const [step, setStep] = useState<Step>("join");
  const [pin, setPin] = useState(params.get("pin") ?? "");
  const [name, setName] = useState(user?.displayName ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [roster, setRoster] = useState<WirePlayer[]>([]);
  const [question, setQuestion] = useState<NewQuestionEvent | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [myResult, setMyResult] = useState<MyResult | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [rank, setRank] = useState<{ position: number; total: number } | null>(null);
  const [standings, setStandings] = useState<WirePlayer[]>([]);
  const [kicked, setKicked] = useState(false);

  const { secondsLeft, pct, start: startCountdown, stop: stopCountdown } = useCountdown();
  const { enabled: soundOn } = useAudio();

  // Tích tắc giục ở những giây cuối, chỉ khi đang trong câu hỏi.
  useSoundCue(
    soundOn && step === "question" && secondsLeft > 0 && secondsLeft <= TICK_FROM_SECONDS
      ? `tick-${question?.index ?? 0}-${secondsLeft}`
      : null,
    () => play("tick", (TICK_FROM_SECONDS - secondsLeft) / (TICK_FROM_SECONDS - 1))
  );
  // socket.id đổi mỗi lần nối lại, nên chốt lại ngay lúc vào phòng thành công.
  const myId = useRef<string | null>(null);

  useEffect(() => {
    if (user?.displayName && !name) setName(user.displayName);
  }, [user?.displayName, name]);

  useEffect(() => {
    if (!socket) return;

    const onPlayers = (list: WirePlayer[]) => setRoster(list);
    const onStarted = () => setStep("waiting");

    const onNewQuestion = (e: NewQuestionEvent) => {
      setQuestion(e);
      setChosen(null);
      setMyResult(null);
      setStep("question");
      startCountdown(e.time_limit);
    };

    const onResult = (e: QuestionResultEvent) => {
      stopCountdown();
      const mine = e.results.find((r) => r.id === myId.current);
      setMyResult(
        mine
          ? { correct: mine.correct, gained: mine.gained, score: mine.score, answered: mine.chosen !== null }
          : null
      );
      // Người chơi nghe kết quả của CHÍNH MÌNH, không phải tiếng chung của phòng.
      play(!mine || mine.chosen === null ? "timeout" : mine.correct ? "correct" : "wrong");
      setExplanation(e.explanation);
      setStep("result");
    };

    const onLeaderboard = (list: WirePlayer[]) => {
      const idx = list.findIndex((p) => p.id === myId.current);
      if (idx >= 0) setRank({ position: idx + 1, total: list.length });
    };

    const onFinished = (list: WirePlayer[]) => {
      stopCountdown();
      play("podium");
      setStandings(list);
      setStep("final");
    };

    const onHostLeft = () => {
      stopCountdown();
      setKicked(true);
    };

    socket.on("players_update", onPlayers);
    socket.on("game_started", onStarted);
    socket.on("new_question", onNewQuestion);
    socket.on("question_result", onResult);
    socket.on("leaderboard_updated", onLeaderboard);
    socket.on("game_finished", onFinished);
    socket.on("host_left", onHostLeft);

    return () => {
      socket.off("players_update", onPlayers);
      socket.off("game_started", onStarted);
      socket.off("new_question", onNewQuestion);
      socket.off("question_result", onResult);
      socket.off("leaderboard_updated", onLeaderboard);
      socket.off("game_finished", onFinished);
      socket.off("host_left", onHostLeft);
    };
  }, [socket, startCountdown, stopCountdown]);

  function join() {
    if (!socket) return;
    if (!/^\d{6}$/.test(pin.trim())) return setJoinError("Mã PIN gồm 6 chữ số.");
    if (!name.trim()) return setJoinError("Vui lòng nhập tên.");

    setJoining(true);
    setJoinError(null);
    socket.emit("join_room", { pin: pin.trim(), name: name.trim() }, (res) => {
      setJoining(false);
      if (!res.ok) return setJoinError(res.error);
      myId.current = socket.id ?? null;
      setStep("waiting");
    });
  }

  function answer(index: number) {
    if (chosen !== null || !socket) return;
    setChosen(index);
    // Xác nhận đã nhận thao tác. Đúng hay sai thì chờ máy chủ chốt mới biết.
    play("join");
    socket.emit("submit_answer", { idx: index });
  }

  if (!connected) return <LoadingBlock label="Đang kết nối máy chủ..." />;

  if (kicked) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Host đã rời phòng</CardTitle>
          <CardDescription>Trận đấu đã kết thúc.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()}>Vào phòng khác</Button>
        </CardContent>
      </Card>
    );
  }

  /* ─── Nhập PIN ─────────────────────────────────────────────────────────── */
  if (step === "join") {
    return (
      <div className="mx-auto max-w-md py-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>🦸 Tham gia trận đấu</CardTitle>
            <CardDescription>
              {user
                ? "Kết quả sẽ được lưu vào tài khoản của bạn."
                : "Bạn đang chơi với tư cách khách — đăng nhập nếu muốn lưu kết quả."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Mã PIN</Label>
              <Input
                id="pin"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.4em]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Tên hiển thị</Label>
              <Input
                id="name"
                value={name}
                maxLength={LIMITS.PLAYER_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="Tên của bạn"
              />
            </div>

            {joinError && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {joinError}
              </p>
            )}

            <Button className="w-full" size="lg" onClick={join} disabled={joining}>
              Tham gia ngay 🚀
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ─── Chờ ──────────────────────────────────────────────────────────────── */
  if (step === "waiting") {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="text-6xl" aria-hidden>⏳</p>
        <h1 className="font-display text-2xl font-bold">Đang chờ host bắt đầu...</h1>
        <p className="text-muted-foreground">
          Xin chào, <strong className="text-foreground">{name}</strong>!
        </p>
        {roster.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2">
            {roster.map((p) => (
              <li key={p.id} className="rounded-full bg-secondary px-3 py-1.5 text-sm">
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  /* ─── Trả lời ──────────────────────────────────────────────────────────── */
  if (step === "question" && question) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            Câu {question.index + 1} / {question.total}
          </Badge>
          <span className="font-display text-xl font-bold tabular-nums">{secondsLeft}s</span>
        </div>

        <Progress value={pct} indicatorClassName="transition-[transform] duration-1000 ease-linear" />

        <Card>
          <CardContent className="p-5">
            <p className="text-center font-display text-lg font-semibold">{question.q}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {question.opts.map((o, i) => (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={chosen !== null}
              style={answerTileStyle(o.color, i)}
              className={cn(
                "min-h-24 rounded-lg px-3 py-4 text-base font-bold shadow-sm transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                chosen === null ? "hover:brightness-110" : "cursor-not-allowed",
                chosen !== null && chosen !== i && "opacity-50",
                chosen === i && "ring-4 ring-foreground"
              )}
            >
              {o.text}
            </button>
          ))}
        </div>

        {chosen !== null && (
          <p className="text-center font-medium text-muted-foreground" aria-live="polite">
            ✅ Đã nộp đáp án! Chờ kết quả...
          </p>
        )}
      </div>
    );
  }

  /* ─── Kết quả từng câu ─────────────────────────────────────────────────── */
  if (step === "result") {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        {myResult === null || !myResult.answered ? (
          <>
            <p className="font-display text-2xl font-bold text-destructive">⏱️ Không kịp trả lời</p>
            {myResult && <p className="text-muted-foreground">Tổng: {myResult.score} điểm</p>}
          </>
        ) : (
          <>
            <p
              className={cn(
                "font-display text-3xl font-bold",
                myResult.correct ? "text-success" : "text-destructive"
              )}
            >
              {myResult.correct ? "🎉 CHÍNH XÁC!" : "❌ SAI RỒI!"}
            </p>
            <p className="text-lg">
              +{myResult.gained} điểm — Tổng: <strong>{myResult.score}</strong>
            </p>
          </>
        )}

        {rank && (
          <p className="text-muted-foreground">
            Hạng hiện tại: #{rank.position} / {rank.total}
          </p>
        )}

        {explanation && (
          <Card>
            <CardContent className="p-4 text-left text-sm">
              <strong>Giải thích:</strong> {explanation}
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">Chờ host chuyển câu tiếp theo...</p>
      </div>
    );
  }

  /* ─── Kết thúc ─────────────────────────────────────────────────────────── */
  const myIndex = standings.findIndex((p) => p.id === myId.current);
  const me = myIndex >= 0 ? standings[myIndex] : undefined;

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <p className="text-6xl" aria-hidden>
        {myIndex >= 0 && myIndex < 3 ? ["🥇", "🥈", "🥉"][myIndex] : "🏁"}
      </p>
      <h1 className="font-display text-2xl font-bold">
        {myIndex >= 0 ? `Bạn xếp hạng #${myIndex + 1} / ${standings.length}` : "Kết thúc trận đấu!"}
      </h1>
      {me && <p className="font-display text-xl text-primary">Điểm của bạn: {me.score}</p>}

      <div className="space-y-1">
        <h2 className="font-display text-base font-semibold text-muted-foreground">Top 3</h2>
        {standings.slice(0, 3).map((p, i) => (
          <p key={p.id}>
            {["🥇", "🥈", "🥉"][i]} {p.name} — {p.score} điểm
          </p>
        ))}
      </div>

      {!user && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Bạn chơi với tư cách khách nên kết quả này không được lưu lại.
        </p>
      )}

      <Button onClick={() => window.location.reload()}>Chơi ván khác</Button>
    </div>
  );
}
