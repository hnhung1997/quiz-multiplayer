import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { QuizAnalyticsDto } from "@quiz/shared";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { cn, formatPercent } from "@/lib/utils";

export function QuizAnalyticsPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quiz", id, "analytics"],
    queryFn: () => api.get<{ analytics: QuizAnalyticsDto }>(`/api/quizzes/${id}/analytics`),
    enabled: !!id,
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) {
    return <p className="py-16 text-center text-destructive">Không tải được thống kê.</p>;
  }

  const a = data.analytics;
  // Câu càng ít người làm đúng thì càng đáng xem lại trước.
  const hardest = [...a.questions]
    .filter((q) => q.answeredCount > 0)
    .sort((x, y) => x.correctPct - y.correctPct)
    .slice(0, 3)
    .map((q) => q.questionId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Thống kê: {a.quizTitle}</h1>
          <p className="mt-1 text-muted-foreground">
            {a.attemptCount} lượt đã nộp • điểm trung bình {formatPercent(a.averageScorePct)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={`/quizzes/${a.quizId}`}>Về bộ quiz</Link>
        </Button>
      </div>

      {a.attemptCount === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Chưa có ai làm bộ quiz này. Thống kê sẽ xuất hiện sau lượt đầu tiên.
        </p>
      ) : (
        <div className="space-y-4">
          {a.questions.map((q, qi) => {
            const isHard = hardest.includes(q.questionId);
            return (
              <Card key={q.questionId} className={cn(isHard && "border-destructive/50")}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      <span className="text-muted-foreground">Câu {qi + 1}.</span> {q.questionText}
                    </CardTitle>
                    <div className="flex shrink-0 gap-2">
                      {isHard && <Badge variant="destructive">Khó nhất</Badge>}
                      <Badge
                        variant={
                          q.correctPct >= 0.8 ? "success" : q.correctPct >= 0.5 ? "warning" : "destructive"
                        }
                      >
                        {formatPercent(q.correctPct)} đúng
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>{q.answeredCount} lượt trả lời</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {q.distribution.map((d) => {
                    const share = q.answeredCount === 0 ? 0 : d.count / q.answeredCount;
                    return (
                      <div key={d.optionId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className={cn("font-medium", d.isCorrect && "text-success")}>
                            {d.text} {d.isCorrect && "✅"}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {d.count} ({formatPercent(share)})
                          </span>
                        </div>
                        {/* Thanh phân bố: đáp án nhiễu nào hút nhiều lựa chọn sai. */}
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn("h-full rounded-full", d.isCorrect ? "bg-success" : "bg-destructive/60")}
                            style={{ width: `${share * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
