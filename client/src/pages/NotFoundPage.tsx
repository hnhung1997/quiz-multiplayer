import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="font-display text-6xl font-bold text-muted-foreground">404</p>
      <h1 className="font-display text-2xl font-semibold">Không tìm thấy trang này</h1>
      <p className="text-muted-foreground">Có thể đường dẫn đã đổi hoặc bạn gõ nhầm.</p>
      <Button asChild>
        <Link to="/hub">Về trung tâm</Link>
      </Button>
    </div>
  );
}
