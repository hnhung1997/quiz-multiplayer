import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { Role } from "@quiz/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/spinner";
import { formatDateTime } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { quizzes: number; attempts: number };
}

const ROLES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];
const ROLE_LABEL: Record<Role, string> = {
  STUDENT: "Học sinh",
  TEACHER: "Giáo viên",
  ADMIN: "Quản trị",
};

export function AdminPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => api.get<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; role?: Role; isActive?: boolean }) =>
      api.patch(`/api/admin/users/${input.id}`, {
        ...(input.role ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Không cập nhật được."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Quản trị người dùng</h1>
        <p className="mt-1 text-muted-foreground">
          Đổi quyền hoặc vô hiệu hoá tài khoản. Mọi phiên đăng nhập cũ sẽ bị thu hồi ngay.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên, email..."
          className="pl-9"
          aria-label="Tìm người dùng"
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {usersQuery.isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-2">
          {usersQuery.data?.users.map((u) => {
            const isSelf = u.id === me?.id;
            return (
              <Card key={u.id} className={!u.isActive ? "opacity-60" : undefined}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {u.displayName}{" "}
                      <span className="font-normal text-muted-foreground">@{u.username}</span>
                      {isSelf && <Badge variant="outline" className="ml-2">bạn</Badge>}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                      {!u.isActive && <Badge variant="destructive">Đã khoá</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {u.email} • {u._count.quizzes} bộ quiz • {u._count.attempts} lượt làm •
                    đăng nhập gần nhất {formatDateTime(u.lastLoginAt)}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((r) => (
                      <Button
                        key={r}
                        size="sm"
                        variant={u.role === r ? "default" : "outline"}
                        disabled={isSelf || u.role === r || updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: u.id, role: r })}
                      >
                        {ROLE_LABEL[r]}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant={u.isActive ? "destructive" : "success"}
                      disabled={isSelf || updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? "Vô hiệu hoá" : "Mở lại"}
                    </Button>
                  </div>
                  {isSelf && (
                    <p className="text-xs text-muted-foreground">
                      Không thể tự đổi quyền hoặc tự khoá tài khoản của mình.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
