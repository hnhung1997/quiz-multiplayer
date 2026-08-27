import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "@quiz/shared";
import { useAuth } from "@/providers/auth-provider";
import { LoadingBlock } from "@/components/ui/spinner";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingBlock label="Đang kiểm tra phiên đăng nhập..." />;

  if (!user) {
    // Nhớ chỗ đang muốn vào để đăng nhập xong quay lại đúng nơi.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Không đủ quyền</h1>
        <p className="mt-2 text-muted-foreground">
          Trang này dành cho {roles.join(" hoặc ")}. Tài khoản của bạn là {user.role}.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
