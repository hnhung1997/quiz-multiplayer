import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@quiz/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/hub";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  if (user) return <Navigate to={from} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values.identifier, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Không thể đăng nhập.");
    }
  });

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>Đăng nhập</CardTitle>
          <CardDescription>Dùng email hoặc tên đăng nhập của bạn.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="identifier">Email hoặc tên đăng nhập</Label>
              <Input id="identifier" autoComplete="username" {...register("identifier")} />
              {errors.identifier && (
                <p className="text-sm text-destructive">{errors.identifier.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {serverError && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="size-4" />}
              Đăng nhập
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Đăng ký
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
