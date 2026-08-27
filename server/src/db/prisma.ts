import { PrismaClient } from "@prisma/client";
import { isProd } from "../config/env.ts";

/**
 * Một client duy nhất cho cả tiến trình. `--watch` nạp lại module nên phải
 * giữ trên globalThis, nếu không mỗi lần sửa file lại mở thêm một pool
 * (gói free của Supabase rất ít kết nối).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["error"] : ["warn", "error"],
  });

if (!isProd) globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
