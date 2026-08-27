import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role } from "@quiz/shared";
import { HttpError } from "../utils/http.ts";
import { verifyAccessToken } from "./jwt.ts";

export interface AuthUser {
  id: string;
  role: Role;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Gắn req.user nếu có token hợp lệ, nhưng không chặn khách vãng lai. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, username: payload.username };
  } catch {
    // Token hỏng thì coi như chưa đăng nhập, để route tự quyết.
  }
  next();
};

/** Bắt buộc đăng nhập. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readBearer(req);
  if (!token) return next(HttpError.unauthorized());
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, username: payload.username };
    next();
  } catch (err) {
    next(err);
  }
};

/** Bắt buộc đăng nhập và thuộc một trong các vai trò cho trước. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(HttpError.forbidden(`Cần quyền ${roles.join(" hoặc ")}.`));
    }
    next();
  };
}

/** Chủ sở hữu hoặc ADMIN. Dùng cho mọi thao tác sửa/xoá nội dung. */
export function assertCanEdit(user: AuthUser | undefined, ownerId: string): AuthUser {
  if (!user) throw HttpError.unauthorized();
  if (user.role !== "ADMIN" && user.id !== ownerId) {
    throw HttpError.forbidden("Bạn không phải chủ sở hữu nội dung này.");
  }
  return user;
}
