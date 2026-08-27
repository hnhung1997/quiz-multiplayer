import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, ClipboardCheck, Target, Users } from "lucide-react";
import type { AttemptSummaryDto, MeStatsDto } from "@quiz/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { formatDateTime, formatPercent } from "@/lib/utils";

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Award;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="size-8 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  const { user } = useAuth();

  const statsQuery = useQuery({
    queryKey: ["me", "stats"],
    queryFn: () => api.get<{ stats: MeStatsDto }>("/api/me/stats"),
  });

  const historyQuery = useQuery({
    queryKey: ["me", "attempts"],
    queryFn: () => api.get<{ attempts: AttemptSummaryDto[]; total: number }>("/api/me/attempts?limit=50"),
  });

  if (statsQuery.isLoading) return <LoadingBlock />;

  const stats = statsQuery.data?.stats;
  const attempts = historyQuery.data?.attempts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{user?.displayName}</h1>
        <p className="mt-1 text-muted-foreground">
          {user?.email} • {user?.username}
        </p>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={ClipboardCheck} label="Tổng lượt" value={String(stats.totalAttempts)} />
          <StatTile icon={Target} label="Độ chính xác" value={formatPercent(stats.averageAccuracy)} />
          <StatTile icon={Users} label="Chơi nhóm" value={String(stats.liveAttempts)} />
          <StatTile icon={Award} label="Điểm cao nhất" value={String(stats.bestScore)} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử</CardTitle>
          <CardDescription>Cả bài kiểm tra và các ván chơi nhóm.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <LoadingBlock />
          ) : attempts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-muted-foreground">Bạn chưa có lượt nào được ghi nhận.</p>
              <Button asChild className="mt-4">
                <Link to="/quizzes">Bắt đầu một bài</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {attempts.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/results/${a.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 transition hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{a.quizTitle}</span>
                    <Badge variant={a.mode === "TEST" ? "secondary" : "default"}>
                      {a.mode === "TEST" ? "Kiểm tra" : "Chơi nhóm"}
                    </Badge>
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {a.correctCount}/{a.totalQuestions} ({formatPercent(a.accuracy)})
                    </span>
                    {a.rank !== null && <Badge variant="warning">#{a.rank}</Badge>}
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(a.submittedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
