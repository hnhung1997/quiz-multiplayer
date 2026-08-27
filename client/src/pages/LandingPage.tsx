import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users, BookOpen, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { welcomeConfetti } from "@/features/spinner/effects";

const HIGHLIGHTS = [
  { icon: Users, title: "Chơi nhóm", desc: "Mở phòng, chia mã PIN, cả lớp cùng trả lời trên điện thoại." },
  { icon: BookOpen, title: "Ngân hàng câu hỏi", desc: "Soạn một lần, dùng lại cho nhiều bộ quiz khác nhau." },
  { icon: ClipboardCheck, title: "Chế độ kiểm tra", desc: "Làm cả đề như bài thi, nộp một lần, xem phân tích chi tiết." },
];

export function LandingPage() {
  useEffect(() => {
    welcomeConfetti();
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Nhóm 1 rất vui được gặp các bạn
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-6xl">
            Quiz Siêu Nhân
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Học mà chơi, chơi mà học. Tạo câu hỏi, mở phòng cho cả lớp, hoặc luyện tập một mình —
            tất cả trong một chỗ.
          </p>
        </div>

        <img
          src="/anhnensieunhan.jpg"
          alt="Nhóm siêu nhân"
          className="w-full max-w-2xl rounded-lg border border-border shadow-lg"
          loading="eager"
        />

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="xl">
            <Link to="/hub">
              Bắt đầu <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link to="/play">Vào phòng bằng mã PIN</Link>
          </Button>
        </div>

        <ul className="grid w-full gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="rounded-lg border border-border bg-card p-5 text-left">
              <h.icon className="mb-3 size-6 text-primary" aria-hidden />
              <h2 className="font-display text-base font-semibold">{h.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{h.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
