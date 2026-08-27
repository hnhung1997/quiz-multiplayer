/**
 * Đọc và kiểm tra biến môi trường một lần, thoát ngay nếu thiếu.
 * Thà chết lúc khởi động còn hơn lỗi mơ hồ lúc đang chạy.
 */
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "Thiếu DATABASE_URL"),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET cần ít nhất 32 ký tự (openssl rand -hex 32)"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`❌ Cấu hình môi trường không hợp lệ:\n${issues}\n\nXem .env.example.`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

if (env.DATABASE_URL.includes(":6543") && !env.DATABASE_URL.includes("pgbouncer=true")) {
  console.warn(
    "⚠️  DATABASE_URL trỏ tới cổng 6543 (transaction pooler) nhưng thiếu `pgbouncer=true`.\n" +
      "   Prisma sẽ lỗi prepared statement lúc tải cao. Xem .env.example."
  );
}
