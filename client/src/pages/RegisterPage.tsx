import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@quiz/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api";

export function RegisterPage() {
  const { user, register: signUp } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  if (user) return <Navigate to="/hub" replace />;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await signUp(values);
      navigate("/hub", { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Không thể đăng ký.");
    }
  });

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>Tạo tài khoản</CardTitle>
          <CardDescription>
            Có tài khoản thì kết quả chơi và làm bài sẽ được lưu lại cho bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="displayName">Tên hiển thị</Label>
              <Input id="displayName" autoComplete="name" {...register("displayName")} />
              {errors.displayName && (
                <p className="text-sm text-destructive">{errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input id="username" autoComplete="username" {...register("username")} />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
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
              Đăng ký
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Đăng nhập
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
