import type { NextFunction, Request, Response, RequestHandler } from "express";
import { ZodError, type ZodType, type z } from "zod";

/** Lỗi có mã HTTP, để middleware xử lý lỗi trả về đúng status. */
export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }

  static badRequest(msg: string, details?: unknown) { return new HttpError(400, msg, details); }
  static unauthorized(msg = "Bạn cần đăng nhập.") { return new HttpError(401, msg); }
  static forbidden(msg = "Bạn không có quyền thực hiện thao tác này.") { return new HttpError(403, msg); }
  static notFound(msg = "Không tìm thấy.") { return new HttpError(404, msg); }
  static conflict(msg: string) { return new HttpError(409, msg); }
}

/** Bọc handler async để lỗi văng ra được chuyển tới errorHandler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Kiểm tra body bằng zod, ném HttpError 400 kèm chi tiết nếu sai.
 * Suy ra kiểu ĐẦU RA của schema — schema có `.default()` nên kiểu vào và ra khác nhau.
 */
export function parseBody<S extends ZodType>(schema: S, body: unknown): z.output<S> {
  try {
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw HttpError.badRequest(
        err.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
        err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
      );
    }
    throw err;
  }
}

/**
 * Lỗi kết nối CSDL nhận diện qua TÊN LỚP, không phải mã lỗi:
 * `PrismaClientInitializationError` không mang `code` (P1000 chỉ nằm trong
 * phần chữ của thông báo). Trả 503 kèm gợi ý sẽ đỡ mò hơn 500 trống rỗng.
 */
const DB_DOWN_CODES = new Set(["P1000", "P1001", "P1002", "P1008", "P1017", "P2024"]);

function errName(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const name = (err as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

function prismaErrorCode(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function isDbUnreachable(err: unknown): boolean {
  if (errName(err) === "PrismaClientInitializationError") return true;
  const code = prismaErrorCode(err);
  return code !== null && DB_DOWN_CODES.has(code);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  if (isDbUnreachable(err)) {
    console.error("[db] Không kết nối được cơ sở dữ liệu:", errName(err));
    res.status(503).json({
      error: "Không kết nối được cơ sở dữ liệu. Kiểm tra DATABASE_URL trong .env.",
    });
    return;
  }

  const code = prismaErrorCode(err);

  // Vi phạm ràng buộc duy nhất — thường là email/tên đăng nhập đã tồn tại.
  if (code === "P2002") {
    res.status(409).json({ error: "Dữ liệu này đã tồn tại." });
    return;
  }

  if (code === "P2025") {
    res.status(404).json({ error: "Không tìm thấy." });
    return;
  }

  console.error("Lỗi không lường trước:", err);
  res.status(500).json({ error: "Lỗi máy chủ." });
}
