import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Shield, Sparkles, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SoundToggle } from "@/components/sound-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Học sinh",
  TEACHER: "Giáo viên",
  ADMIN: "Quản trị",
};

export function AppLayout() {
  const { user, logout, isAuthor } = useAuth();
  const navigate = useNavigate();

  const nav = [
    { to: "/hub", label: "Trung tâm" },
    { to: "/quizzes", label: "Thư viện" },
    { to: "/play", label: "Vào phòng" },
    ...(isAuthor ? [{ to: "/host", label: "Mở phòng" }] : []),
  ];

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <Sparkles className="size-5 text-primary" aria-hidden />
            <span className="hidden sm:inline">Quiz Siêu Nhân</span>
          </Link>

          <nav className="ml-auto flex items-center gap-1" aria-label="Điều hướng chính">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2.5 py-2 text-sm font-medium transition-colors sm:px-3",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}

            <SoundToggle />
            <ThemeToggle />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Tài khoản">
                    <UserIcon className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuLabel className="text-sm font-semibold text-foreground">
                    {user.displayName}
                    <Badge variant="secondary" className="ml-2">
                      {ROLE_LABEL[user.role] ?? user.role}
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/profile")}>
                    <UserIcon className="size-4" aria-hidden /> Hồ sơ & kết quả
                  </DropdownMenuItem>
                  {isAuthor && (
                    <DropdownMenuItem onSelect={() => navigate("/banks")}>
                      <Sparkles className="size-4" aria-hidden /> Ngân hàng câu hỏi
                    </DropdownMenuItem>
                  )}
                  {user.role === "ADMIN" && (
                    <DropdownMenuItem onSelect={() => navigate("/admin")}>
                      <Shield className="size-4" aria-hidden /> Quản trị
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="size-4" aria-hidden /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className="ml-1">
                <Link to="/login">Đăng nhập</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Quiz Siêu Nhân — học mà chơi, chơi mà học.
      </footer>
    </div>
  );
}
