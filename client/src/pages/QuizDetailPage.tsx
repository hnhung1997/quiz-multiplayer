import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardCheck, Globe, Lock, Monitor, Pencil } from "lucide-react";
import type { QuestionDto, QuizSummaryDto } from "@quiz/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";
import { answerTileStyle } from "@/lib/color";

interface QuizDetailResponse {
  quiz: QuizSummaryDto;
  questions: QuestionDto[];
  canEdit: boolean;
}

export function QuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthor } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["quiz", id],
    queryFn: () => api.get<QuizDetailResponse>(`/api/quizzes/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <LoadingBlock />;
  if (isError) {
    return (
      <p className="py-16 text-center text-destructive">
        {error instanceof Error ? error.message : "Không tải được bộ quiz."}
      </p>
    );
  }
  if (!data) return null;

  const { quiz, questions, canEdit } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold">{quiz.title}</h1>
            <Badge variant={quiz.visibility === "PUBLIC" ? "secondary" : "outline"}>
              {quiz.visibility === "PUBLIC" ? (
                <>
                  <Globe className="mr-1 size-3" aria-hidden /> Công khai
                </>
              ) : (
                <>
                  <Lock className="mr-1 size-3" aria-hidden /> Riêng tư
                </>
              )}
            </Badge>
          </div>
          <p className="text-muted-foreground">{quiz.description || "Không có mô tả."}</p>
          <p className="text-sm text-muted-foreground">
            {quiz.questionCount} câu hỏi • tác giả {quiz.owner.displayName}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {quiz.allowTestMode && quiz.questionCount > 0 && (
            <Button asChild>
              <Link to={user ? `/test/${quiz.id}` : "/login"}>
                <ClipboardCheck className="size-4" aria-hidden /> Làm bài kiểm tra
              </Link>
            </Button>
          )}
          {isAuthor && quiz.questionCount > 0 && (
            <Button asChild variant="outline">
              <Link to={`/host?quiz=${quiz.id}`}>
                <Monitor className="size-4" aria-hidden /> Mở phòng
              </Link>
            </Button>
          )}
          {canEdit && (
            <>
              <Button asChild variant="outline">
                <Link to={`/quizzes/${quiz.id}/edit`}>
                  <Pencil className="size-4" aria-hidden /> Sửa
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/quizzes/${quiz.id}/analytics`}>
                  <BarChart3 className="size-4" aria-hidden /> Thống kê
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Đáp án đúng chỉ hiện với tác giả — bạn sẽ thấy sau khi chơi hoặc nộp bài.
        </p>
      )}

      <div className="space-y-3">
        {questions.map((q, qi) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">
                <span className="text-muted-foreground">Câu {qi + 1}.</span> {q.text}
              </CardTitle>
              <CardDescription>{q.timeLimit} giây</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => (
                <div
                  key={o.id}
                  style={answerTileStyle(o.color, oi)}
                  className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold"
                >
                  <span>{o.text}</span>
                  {/* isCorrect chỉ có mặt khi người xem là tác giả. */}
                  {o.isCorrect === true && <span aria-label="Đáp án đúng">✅</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
