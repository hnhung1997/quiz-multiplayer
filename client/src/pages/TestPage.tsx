/**
 * Chế độ kiểm tra: cả đề hiện ra một lần như tờ giấy thi.
 *
 * Dữ liệu câu hỏi tải về ở đây KHÔNG chứa đáp án đúng (máy chủ đã lược bỏ),
 * nên có mở DevTools cũng không dò được. Việc chấm nằm hoàn toàn ở máy chủ,
 * lúc nộp bài.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Send } from "lucide-react";
import type { QuestionDto } from "@quiz/shared";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { answerTileStyle } from "@/lib/color";
import { cn } from "@/lib/utils";

interface StartResponse {
  attemptId: string;
  quiz: { id: string; title: string; description: string | null };
  startedAt: string;
  questions: QuestionDto[];
}

export function TestPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startQuery = useQuery({
    queryKey: ["attempt", "start", quizId],
    queryFn: () => api.post<StartResponse>("/api/attempts", { quizId }),
    enabled: !!quizId,
    // Bắt đầu một lượt làm bài là thao tác có tác dụng phụ — đừng gọi lại tự động.
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Đồng hồ đếm lên, chỉ để người làm bài biết mình đã ngồi bao lâu.
  useEffect(() => {
    if (!startQuery.data) return;
    const started = new Date(startQuery.data.startedAt).getTime();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startQuery.data]);

  const submitMutation = useMutation({
    mutationFn: (attemptId: string) =>
      api.post(`/api/attempts/${attemptId}/submit`, {
        answers: (startQuery.data?.questions ?? []).map((q) => ({
          questionId: q.id,
          optionId: answers[q.id] ?? null,
        })),
      }),
    onSuccess: () => {
      if (startQuery.data) navigate(`/results/${startQuery.data.attemptId}`, { replace: true });
    },
    onError: (e) => {
      setConfirmOpen(false);
      setError(e instanceof ApiError ? e.message : "Không nộp được bài.");
    },
  });

  const questions = startQuery.data?.questions ?? [];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]).length,
    [questions, answers]
  );
  const unanswered = questions.length - answeredCount;

  if (startQuery.isLoading) return <LoadingBlock label="Đang chuẩn bị đề..." />;

  if (startQuery.isError) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle>Không mở được bài kiểm tra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {startQuery.error instanceof ApiError
              ? startQuery.error.message
              : "Đã có lỗi xảy ra."}
          </p>
          <Button onClick={() => navigate("/quizzes")}>Về thư viện</Button>
        </CardContent>
      </Card>
    );
  }

  if (!startQuery.data) return null;
  const { quiz } = startQuery.data;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="sticky top-16 z-30 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold">{quiz.title}</h1>
            <p className="text-sm text-muted-foreground">
              Đã làm {answeredCount} / {questions.length} câu
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {mm}:{ss}
          </Badge>
        </div>
        <Progress
          value={questions.length === 0 ? 0 : (answeredCount / questions.length) * 100}
          className="mt-2"
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Chọn đáp án cho từng câu rồi bấm nộp bài. Bạn chỉ nộp được một lần.
      </p>

      <ol className="space-y-4">
        {questions.map((q, qi) => {
          const picked = answers[q.id];
          return (
            <li key={q.id}>
              <Card className={cn(!picked && "border-dashed")}>
                <CardHeader>
                  <CardTitle className="text-base">
                    <span className="text-muted-foreground">Câu {qi + 1}.</span> {q.text}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, oi) => {
                    const chosen = picked === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                        style={answerTileStyle(o.color, oi)}
                        aria-pressed={chosen}
                        className={cn(
                          "rounded-md px-3 py-3 text-left text-sm font-semibold transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          chosen ? "ring-4 ring-foreground" : "opacity-75 hover:opacity-100"
                        )}
                      >
                        {o.text}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <Button size="xl" className="w-full" onClick={() => setConfirmOpen(true)}>
        <Send className="size-5" aria-hidden /> Nộp bài
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nộp bài?</DialogTitle>
            <DialogDescription>
              {unanswered > 0 ? (
                <span className="flex items-start gap-2 text-warning">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Còn {unanswered} câu chưa trả lời — những câu này sẽ bị tính là sai.
                </span>
              ) : (
                "Bạn đã trả lời hết các câu. Sau khi nộp sẽ không sửa được nữa."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Quay lại làm tiếp
            </Button>
            <Button
              onClick={() => submitMutation.mutate(startQuery.data.attemptId)}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending && <Spinner className="size-4" />}
              Nộp bài
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
