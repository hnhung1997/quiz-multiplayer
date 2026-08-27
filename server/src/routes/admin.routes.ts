import { Router } from "express";
import { updateUserSchema } from "@quiz/shared";
import { prisma } from "../db/prisma.ts";
import { requireAuth, requireRole } from "../auth/middleware.ts";
import { HttpError, asyncHandler, parseBody } from "../utils/http.ts";
import { revokeAllForUser } from "../auth/jwt.ts";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      select: {
        id: true, email: true, username: true, displayName: true, role: true,
        isActive: true, createdAt: true, lastLoginAt: true,
        _count: { select: { quizzes: true, attempts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ users });
  })
);

adminRouter.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const input = parseBody(updateUserSchema, req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw HttpError.notFound("Không tìm thấy người dùng.");

    // Không cho tự hạ quyền hoặc tự khoá mình — dễ tự nhốt ngoài cửa.
    if (target.id === req.user!.id && (input.role !== undefined || input.isActive === false)) {
      throw HttpError.badRequest("Không thể tự đổi quyền hoặc tự vô hiệu hoá tài khoản của mình.");
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: input,
      select: {
        id: true, email: true, username: true, displayName: true,
        role: true, isActive: true, createdAt: true,
      },
    });

    // Đổi quyền hoặc khoá tài khoản thì mọi phiên cũ phải hết hiệu lực.
    if (input.role !== undefined || input.isActive === false) {
      await revokeAllForUser(user.id);
    }

    res.json({ user });
  })
);
