/**
 * Lớp gọi API.
 *
 * Access token chỉ nằm trong bộ nhớ (không đụng localStorage) — refresh token
 * mới là thứ sống lâu, và nó nằm trong cookie httpOnly nên JavaScript không
 * đọc được. Tải lại trang thì gọi /refresh một lần để lấy access token mới.
 */

let accessToken: string | null = null;
/** Gom mọi lần refresh trùng nhau vào một request duy nhất. */
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function readError(res: Response): Promise<ApiError> {
  let message = `Lỗi ${res.status}`;
  let details: unknown;
  try {
    const body = (await res.json()) as { error?: string; details?: unknown };
    if (body.error) message = body.error;
    details = body.details;
  } catch {
    // Phản hồi không phải JSON — giữ thông báo mặc định.
  }
  return new ApiError(res.status, message, details);
}

/** Đổi cookie refresh lấy access token mới. Trả null nếu chưa/hết đăng nhập. */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const body = (await res.json()) as { accessToken: string };
      setAccessToken(body.accessToken);
      return body.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Bỏ qua bước tự refresh — dùng cho chính các endpoint xác thực. */
  skipRefresh?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, skipRefresh = false } = options;

  const send = (token: string | null) =>
    fetch(path, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  let res = await send(accessToken);

  // Access token hết hạn (15 phút) là chuyện thường — thử làm mới đúng một lần.
  if (res.status === 401 && !skipRefresh) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
  }

  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T,>(path: string) => apiFetch<T>(path),
  post: <T,>(path: string, body?: unknown, opts?: { skipRefresh?: boolean }) =>
    apiFetch<T>(path, { method: "POST", body, ...opts }),
  patch: <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  delete: <T,>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
