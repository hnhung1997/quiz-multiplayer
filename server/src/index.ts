import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";

import { env, isProd } from "./config/env.ts";
import { disconnectPrisma, prisma } from "./db/prisma.ts";
import { errorHandler } from "./utils/http.ts";
import { authRouter } from "./routes/auth.routes.ts";
import { banksRouter } from "./routes/banks.routes.ts";
import { questionsRouter } from "./routes/questions.routes.ts";
import { quizzesRouter } from "./routes/quizzes.routes.ts";
import { attemptsRouter } from "./routes/attempts.routes.ts";
import { meRouter } from "./routes/me.routes.ts";
import { adminRouter } from "./routes/admin.routes.ts";
import { registerRealtime } from "./realtime/index.ts";
import { roomManager } from "./realtime/room.manager.ts";
import type { SocketData } from "./realtime/index.ts";
import type { ClientToServerEvents, ServerToClientEvents } from "@quiz/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const clientDist = path.join(rootDir, "client", "dist");

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

/**
 * Ở chế độ phát triển, Vite chạy cổng 5173 và proxy sang đây nên phần lớn
 * request là cùng origin. Vẫn mở CORS cho trường hợp gọi thẳng, kèm
 * credentials để cookie refresh đi qua được.
 */
if (!isProd) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === env.CLIENT_ORIGIN) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });
}

/* ─── API ────────────────────────────────────────────────────────────────── */

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up", rooms: roomManager.size() });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/banks", banksRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/quizzes", quizzesRouter);
app.use("/api/attempts", attemptsRouter);
app.use("/api/me", meRouter);
app.use("/api/admin", adminRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Không có API này." });
});

app.use(errorHandler);

/* ─── Giao diện ──────────────────────────────────────────────────────────── */
/*
 * Ưu tiên bản React đã build. Nếu chưa build thì tạm phục vụ thư mục public cũ,
 * để trong lúc chuyển đổi ứng dụng vẫn chạy được.
 */

const hasClientBuild = fs.existsSync(path.join(clientDist, "index.html"));

if (hasClientBuild) {
  app.use(express.static(clientDist));
  // SPA fallback — đăng ký SAU /api và /socket.io nên không thể che mất chúng.
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("*", (_req, res) => {
    res
      .status(503)
      .type("html")
      .send(
        `<!doctype html><meta charset="utf-8"><title>Chưa build giao diện</title>` +
          `<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem">` +
          `<h1>Chưa build giao diện React</h1>` +
          `<p>Chạy <code>npm run build</code> rồi <code>npm start</code>, ` +
          `hoặc <code>npm run dev</code> để mở Vite ở cổng 5173.</p></body>`
      );
  });
}

/* ─── Realtime ───────────────────────────────────────────────────────────── */

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(server, {
  cors: isProd ? { origin: false } : { origin: env.CLIENT_ORIGIN, credentials: true },
});
registerRealtime(io);

/* ─── Khởi động & tắt gọn ────────────────────────────────────────────────── */

server.listen(env.PORT, () => {
  console.log(`✅ Quiz Siêu Nhân đang chạy tại http://localhost:${env.PORT}`);
  if (hasClientBuild) {
    console.log("   Giao diện: client/dist");
  } else {
    console.log("   ⚠️  Chưa build giao diện. Chạy `npm run build`, hoặc `npm run dev` cho Vite.");
  }
});

async function shutdown(signal: string) {
  console.log(`\n${signal} — đang tắt...`);
  io.close();
  server.close();
  await disconnectPrisma();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
