import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Globe, Lock, Plus } from "lucide-react";
import type { QuizSummaryDto } from "@quiz/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingBlock } from "@/components/ui/spinner";

function QuizGrid({ quizzes, empty }: { quizzes: QuizSummaryDto[]; empty: string }) {
  if (quizzes.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {quizzes.map((q) => (
        <Card key={q.id} className="flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{q.title}</CardTitle>
              <Badge variant={q.visibility === "PUBLIC" ? "secondary" : "outline"}>
                {q.visibility === "PUBLIC" ? (
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
            <CardDescription className="line-clamp-2">
              {q.description || "Không có mô tả."}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{q.questionCount} câu hỏi</span>
              <span aria-hidden>•</span>
              <span>{q.owner.displayName}</span>
              {!q.isPublished && <Badge variant="warning">Chưa xuất bản</Badge>}
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link to={`/quizzes/${q.id}`}>Xem</Link>
              </Button>
              {q.allowTestMode && q.questionCount > 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/test/${q.id}`} aria-label={`Làm bài kiểm tra ${q.title}`}>
                    <ClipboardCheck className="size-4" aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function LibraryPage() {
  const { user, isAuthor } = useAuth();
  const [tab, setTab] = useState("public");

  const publicQuery = useQuery({
    queryKey: ["quizzes", "public"],
    queryFn: () => api.get<{ quizzes: QuizSummaryDto[] }>("/api/quizzes?scope=public"),
  });

  const mineQuery = useQuery({
    queryKey: ["quizzes", "mine"],
    queryFn: () => api.get<{ quizzes: QuizSummaryDto[] }>("/api/quizzes?scope=mine"),
    enabled: !!user && tab === "mine",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Thư viện quiz</h1>
          <p className="mt-1 text-muted-foreground">
            Chơi nhóm hoặc làm bài kiểm tra từ các bộ quiz có sẵn.
          </p>
        </div>
        {isAuthor && (
          <Button asChild>
            <Link to="/quizzes/new">
              <Plus className="size-4" aria-hidden /> Tạo bộ quiz
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="public">Công khai</TabsTrigger>
          {user && <TabsTrigger value="mine">Của tôi</TabsTrigger>}
        </TabsList>

        <TabsContent value="public">
          {publicQuery.isLoading ? (
            <LoadingBlock />
          ) : publicQuery.isError ? (
            <p className="py-12 text-center text-destructive">Không tải được thư viện.</p>
          ) : (
            <QuizGrid
              quizzes={publicQuery.data?.quizzes ?? []}
              empty="Chưa có bộ quiz công khai nào."
            />
          )}
        </TabsContent>

        {user && (
          <TabsContent value="mine">
            {mineQuery.isLoading ? (
              <LoadingBlock />
            ) : (
              <QuizGrid
                quizzes={mineQuery.data?.quizzes ?? []}
                empty="Bạn chưa tạo bộ quiz nào."
              />
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
