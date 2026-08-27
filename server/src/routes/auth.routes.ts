import { Router } from "express";
import type { CookieOptions } from "express";
import { loginSchema, registerSchema, type PublicUser, type Role } from "@quiz/shared";
import { env, isProd } from "../config/env.ts";
import { prisma } from "../db/prisma.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import {
  REFRESH_COOKIE,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "../auth/jwt.ts";
import { requireAuth } from "../auth/middleware.ts";
import { HttpError, asyncHandler, parseBody } from "../utils/http.ts";

export const authRouter = Router();

/** Cookie chỉ gửi tới /api/auth — refresh token không cần lộ ở nơi khác. */
const cookieOpts = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

function toPublicUser(u: {
  id: string; email: string; username: string; displayName: string; role: string; createdAt: Date;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    role: u.role as Role,
    createdAt: u.createdAt.toISOString(),
  };
}

function metaOf(req: { headers: Record<string, unknown>; ip?: string | undefined }) {
  const ua = req.headers["user-agent"];
  return { userAgent: typeof ua === "string" ? ua : undefined, ip: req.ip };
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);

    const clash = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
      select: { email: true, username: true },
    });
    if (clash) {
      throw HttpError.conflict(
        clash.email === input.email ? "Email này đã được đăng ký." : "Tên đăng nhập đã có người dùng."
      );
    }

    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        // Người đăng ký mới luôn là học sinh; nâng quyền là việc của ADMIN.
        role: "STUDENT",
      },
    });

    const refresh = await issueRefreshToken(user.id, metaOf(req));
    res.cookie(REFRESH_COOKIE, refresh, cookieOpts());
    res.status(201).json({
      accessToken: signAccessToken({ sub: user.id, role: "STUDENT", username: user.username }),
      user: toPublicUser(user),
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const identifier = input.identifier.toLowerCase();

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: input.identifier }] },
    });

    // Cùng một thông báo cho "không có tài khoản" và "sai mật khẩu",
    // để không tiết lộ email nào đã đăng ký.
    const invalid = HttpError.unauthorized("Email/tên đăng nhập hoặc mật khẩu không đúng.");
    if (!user) {
      await hashPassword(input.password); // tiêu tốn thời gian tương đương, tránh dò theo thời gian
      throw invalid;
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) throw invalid;
    if (!user.isActive) throw HttpError.forbidden("Tài khoản đã bị vô hiệu hoá.");

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const refresh = await issueRefreshToken(user.id, metaOf(req));
    res.cookie(REFRESH_COOKIE, refresh, cookieOpts());
    res.json({
      accessToken: signAccessToken({
        sub: user.id,
        role: user.role as Role,
        username: user.username,
      }),
      user: toPublicUser(user),
    });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (typeof raw !== "string" || !raw) throw HttpError.unauthorized("Chưa đăng nhập.");

    const rotated = await rotateRefreshToken(raw, metaOf(req));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: rotated.userId } });

    res.cookie(REFRESH_COOKIE, rotated.refreshToken, cookieOpts());
    res.json({
      accessToken: signAccessToken({
        sub: rotated.userId,
        role: rotated.role,
        username: rotated.username,
      }),
      user: toPublicUser(user),
    });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (typeof raw === "string" && raw) await revokeRefreshToken(raw);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOpts(), maxAge: undefined });
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw HttpError.unauthorized();
    res.json({ user: toPublicUser(user) });
  })
);
