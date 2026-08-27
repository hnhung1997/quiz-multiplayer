/**
 * Xem lại bài đã nộp. Đến bước này máy chủ mới gửi đáp án đúng — bài đã chấm
 * xong nên không còn gì phải giấu.
 */
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AttemptReviewDto } from "@quiz/shared";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LoadingBlock } from "@/components/ui/spinner";
import { answerTileStyle } from "@/lib/color";
import { cn, formatDuration, formatPercent } from "@/lib/utils";

export function ResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => api.get<{ review: AttemptReviewDto }>(`/api/attempts/${attemptId}`),
    enabled: !!attemptId,
  });

  if (isLoading) return <LoadingBlock label="Đang chấm bài..." />;
  if (isError || !data) {
    return <p className="py-16 text-center text-destructive">Không tải được kết quả.</p>;
  }

  const r = data.review;
  const wrong = r.items.filter((i) => !i.isCorrect);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{r.quizTitle}</CardTitle>
          <p className="font-display text-5xl font-bold text-primary">
            {r.correctCount}/{r.totalQuestions}
          </p>
          <p className="text-muted-foreground">
            Chính xác {formatPercent(r.accuracy)} • Thời gian {formatDuration(r.durationMs)}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress
            value={r.accuracy * 100}
            indicatorClassName={
              r.accuracy >= 0.8 ? "bg-success" : r.accuracy >= 0.5 ? "bg-warning" : "bg-destructive"
            }
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant={r.mode === "TEST" ? "secondary" : "default"}>
              {r.mode === "TEST" ? "Bài kiểm tra" : "Chơi nhóm"}
            </Badge>
            {r.rank !== null && <Badge variant="warning">Hạng #{r.rank}</Badge>}
            <Badge variant="outline">{wrong.length} câu cần xem lại</Badge>
          </div>
        </CardContent>
      </Card>

      {wrong.length > 0 && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <strong>Cần ôn lại:</strong> {wrong.length} câu bên dưới có viền đỏ.
        </p>
      )}

      <ol className="space-y-4">
        {r.items.map((item, i) => (
          <li key={item.questionId}>
            <Card className={cn(item.isCorrect ? "border-success/40" : "border-destructive/50")}>
              <CardHeader>
                <CardTitle className="flex items-start gap-2 text-base">
                  {item.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Đúng" />
                  ) : (
                    <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="Sai" />
                  )}
                  <span>
                    <span className="text-muted-foreground">Câu {i + 1}.</span> {item.questionText}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {item.options.map((o, oi) => {
                    const picked = item.selectedOptionId === o.id;
                    return (
                      <div
                        key={o.id}
                        style={answerTileStyle(o.color, oi)}
                        className={cn(
                          "flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold",
                          o.isCorrect && "ring-4 ring-success",
                          picked && !o.isCorrect && "ring-4 ring-destructive",
                          !o.isCorrect && !picked && "opacity-60"
                        )}
                      >
                        <span>{o.text}</span>
                        <span className="ml-2 shrink-0 text-xs">
                          {o.isCorrect && "✅ đáp án đúng"}
                          {picked && !o.isCorrect && "❌ bạn chọn"}
                          {picked && o.isCorrect && " (bạn chọn)"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {item.selectedOptionId === null && (
                  <p className="text-sm text-muted-foreground">Bạn đã bỏ trống câu này.</p>
                )}

                {item.explanation && (
                  <p className="rounded-md bg-muted/50 p-3 text-sm">
                    <strong>Giải thích:</strong> {item.explanation}
                  </p>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link to="/profile">Xem lịch sử của tôi</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link to={`/quizzes/${r.quizId}`}>Về bộ quiz</Link>
        </Button>
      </div>
    </div>
  );
}
