import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthResponse, PublicUser, Role } from "@quiz/shared";
import { api, refreshAccessToken, setAccessToken } from "@/lib/api";

interface AuthContextValue {
  user: PublicUser | null;
  /** true trong lúc khôi phục phiên lúc mới tải trang. */
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  isAuthor: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục phiên sau khi tải lại trang: cookie refresh vẫn còn thì lấy
  // access token mới, người dùng không phải đăng nhập lại.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (token) {
        try {
          const { user: me } = await api.get<{ user: PublicUser }>("/api/auth/me");
          if (!cancelled) setUser(me);
        } catch {
          if (!cancelled) setUser(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<AuthResponse>(
      "/api/auth/login",
      { identifier, password },
      { skipRefresh: true }
    );
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (input: { email: string; username: string; password: string; displayName: string }) => {
      const res = await api.post<AuthResponse>("/api/auth/register", input, { skipRefresh: true });
      setAccessToken(res.accessToken);
      setUser(res.user);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", undefined, { skipRefresh: true });
    } finally {
      // Dù server có lỗi thì phía client vẫn phải quên phiên này.
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      hasRole,
      isAuthor: user?.role === "TEACHER" || user?.role === "ADMIN",
    }),
    [user, loading, login, register, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong <AuthProvider>");
  return ctx;
}
