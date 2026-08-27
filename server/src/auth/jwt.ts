import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@quiz/shared";
import { env } from "../config/env.ts";
import { prisma } from "../db/prisma.ts";
import { HttpError } from "../utils/http.ts";

export const REFRESH_COOKIE = "qsn_refresh";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  username: string;
}

/* ─── Access token (JWT ngắn hạn, không thu hồi được) ──────────────────── */

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === "string") throw new Error("payload dạng chuỗi");
    return decoded as unknown as AccessTokenPayload;
  } catch {
    throw HttpError.unauthorized("Phiên đăng nhập đã hết hạn.");
  }
}

/* ─── Refresh token (mã ngẫu nhiên, lưu dạng băm, thu hồi được) ────────── */
/*
 * Đây là thứ khiến "đăng xuất" có thật: JWT thuần không thể thu hồi, nên
 * access token để ngắn hạn còn quyền đăng nhập dài hạn nằm ở hàng dữ liệu này.
 */

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function expiryDate(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export interface RequestMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

/** Cấp token mới. Không truyền familyId nghĩa là mở một chuỗi đăng nhập mới. */
export async function issueRefreshToken(
  userId: string,
  meta: RequestMeta,
  familyId?: string
): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      familyId: familyId ?? crypto.randomUUID(),
      expiresAt: expiryDate(),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip?.slice(0, 60) ?? null,
    },
  });
  return raw;
}

export interface RotationResult {
  userId: string;
  role: Role;
  username: string;
  refreshToken: string;
}

/**
 * Đổi refresh token cũ lấy token mới.
 * Nếu bắt gặp token đã bị xoay vòng trước đó → coi như bị đánh cắp,
 * thu hồi toàn bộ chuỗi (family) chứ không chỉ token đó.
 */
export async function rotateRefreshToken(raw: string, meta: RequestMeta): Promise<RotationResult> {
  const tokenHash = hashToken(raw);
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!row) throw HttpError.unauthorized("Phiên đăng nhập không hợp lệ.");

  if (row.revokedAt) {
    // Token này đã dùng rồi → nhiều khả năng bị lộ. Chặn cả chuỗi.
    await prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw HttpError.unauthorized("Phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại.");
  }

  if (row.expiresAt.getTime() < Date.now()) {
    throw HttpError.unauthorized("Phiên đăng nhập đã hết hạn.");
  }

  if (!row.user.isActive) {
    throw HttpError.forbidden("Tài khoản đã bị vô hiệu hoá.");
  }

  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  const next = await issueRefreshToken(row.userId, meta, row.familyId);

  return {
    userId: row.userId,
    role: row.user.role as Role,
    username: row.user.username,
    refreshToken: next,
  };
}

/** Đăng xuất: thu hồi đúng token đang giữ. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Đăng xuất khỏi mọi thiết bị. */
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
