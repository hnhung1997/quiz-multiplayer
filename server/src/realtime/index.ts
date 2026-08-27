/**
 * Lớp realtime: xác thực bắt tay + toàn bộ vòng đời ván chơi.
 *
 * BẤT BIẾN: sự kiện `new_question` không bao giờ mang đáp án đúng.
 * `question_result` là gói tin đầu tiên chứa `correctIndex`.
 */
import type { Server, Socket } from "socket.io";
import {
  SCORING,
  createRoomSchema,
  joinRoomSchema,
  submitAnswerSchema,
  type ClientToServerEvents,
  type Role,
  type ServerToClientEvents,
} from "@quiz/shared";
import { prisma } from "../db/prisma.ts";
import { verifyAccessToken } from "../auth/jwt.ts";
import { maxLivePointsForQuestion, scoreLiveAnswer } from "../services/grading.service.ts";
import { roomManager, type Room, type RoomQuestion } from "./room.manager.ts";

export interface SocketData {
  pin: string | null;
  role: "host" | "player" | null;
  userId: string | null;
  userRole: Role | null;
  username: string | null;
}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** Ghi CSDL ở mốc vòng đời. Hỏng thì ghi log rồi đi tiếp — ván đấu quan trọng hơn. */
function persist(label: string, work: Promise<unknown>): void {
  work.catch((err) => console.error(`[realtime] Lưu "${label}" thất bại:`, err));
}

export function registerRealtime(io: AppServer): void {
  /* ─── Bắt tay: gắn danh tính nếu có token ─────────────────────────────── */
  io.use((socket, next) => {
    socket.data.pin = null;
    socket.data.role = null;
    socket.data.userId = null;
    socket.data.userRole = null;
    socket.data.username = null;

    const token = socket.handshake.auth?.token;
    if (typeof token === "string" && token.length > 0) {
      try {
        const payload = verifyAccessToken(token);
        socket.data.userId = payload.sub;
        socket.data.userRole = payload.role;
        socket.data.username = payload.username;
      } catch {
        // Token hỏng vẫn cho kết nối: khách chơi được phép vào bằng PIN.
      }
    }
    next();
  });

  io.on("connection", (socket: AppSocket) => {
    /* ─── HOST: mở phòng từ một bộ quiz có sẵn ─────────────────────────── */
    socket.on("create_room", async (payload, cb) => {
      try {
        // Trước đây bất kỳ client nào cũng mở được phòng. Giờ phải là giáo viên.
        if (!socket.data.userId) {
          return cb({ ok: false, error: "Bạn cần đăng nhập để mở phòng." });
        }
        if (socket.data.userRole !== "TEACHER" && socket.data.userRole !== "ADMIN") {
          return cb({ ok: false, error: "Chỉ giáo viên mới mở được phòng chơi." });
        }

        const parsed = createRoomSchema.safeParse(payload);
        if (!parsed.success) return cb({ ok: false, error: "Thiếu mã bộ quiz." });

        const quiz = await prisma.quiz.findUnique({
          where: { id: parsed.data.quizId },
          include: {
            questions: {
              orderBy: { position: "asc" },
              include: { question: { include: { options: { orderBy: { position: "asc" } } } } },
            },
          },
        });
        if (!quiz) return cb({ ok: false, error: "Không tìm thấy bộ quiz." });

        const isOwner = quiz.ownerId === socket.data.userId || socket.data.userRole === "ADMIN";
        if (!isOwner && !(quiz.visibility === "PUBLIC" && quiz.isPublished)) {
          return cb({ ok: false, error: "Bộ quiz này ở chế độ riêng tư." });
        }
        if (quiz.questions.length === 0) {
          return cb({ ok: false, error: "Bộ quiz chưa có câu hỏi nào." });
        }

        const questions: RoomQuestion[] = quiz.questions.map((qq) => {
          const q = qq.question;
          const options = q.options.map((o) => ({
            id: o.id,
            text: o.text,
            color: o.color,
            isCorrect: o.isCorrect,
          }));
          const correctIndex = Math.max(0, options.findIndex((o) => o.isCorrect));
          return {
            id: q.id,
            text: q.text,
            explanation: q.explanation,
            imageCorrect: q.imageCorrect,
            imageWrong: q.imageWrong,
            timeLimit: qq.timeLimitOverride ?? q.timeLimit,
            options,
            correctIndex,
          };
        });

        const pin = roomManager.generatePin();
        const room = roomManager.create({
          pin,
          hostSocketId: socket.id,
          hostUserId: socket.data.userId,
          quizId: quiz.id,
          quizTitle: quiz.title,
          sessionId: null,
          questions,
          state: "lobby",
          currentIndex: -1,
          players: new Map(),
          timer: null,
          questionStartAt: null,
          currentAnswers: new Map(),
        });

        socket.join(pin);
        socket.data.role = "host";
        socket.data.pin = pin;

        // Tạo bản ghi phiên; nếu hỏng thì ván vẫn chơi được, chỉ không lưu kết quả.
        try {
          const session = await prisma.gameSession.create({
            data: { quizId: quiz.id, hostId: socket.data.userId, pin, status: "LOBBY" },
          });
          room.sessionId = session.id;
        } catch (err) {
          console.error("[realtime] Không tạo được game_session:", err);
        }

        cb({ ok: true, data: { pin, totalQuestions: questions.length, quizTitle: quiz.title } });
      } catch (err) {
        console.error("[realtime] create_room lỗi:", err);
        cb({ ok: false, error: "Không thể tạo phòng." });
      }
    });

    /* ─── NGƯỜI CHƠI: vào phòng bằng PIN (khách vẫn được vào) ──────────── */
    socket.on("join_room", (payload, cb) => {
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        return cb({ ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." });
      }

      const room = roomManager.get(parsed.data.pin);
      if (!room) return cb({ ok: false, error: "Mã PIN không tồn tại." });

      const gate = roomManager.canJoin(room);
      if (!gate.ok) return cb({ ok: false, error: gate.error });

      const name = parsed.data.name;
      if (roomManager.isNameTaken(room, name)) {
        return cb({ ok: false, error: "Tên này đã có người dùng trong phòng." });
      }

      room.players.set(socket.id, {
        socketId: socket.id,
        name,
        score: 0,
        streak: 0,
        correctCount: 0,
        connected: true,
        userId: socket.data.userId,
        attemptId: null,
      });

      socket.join(room.pin);
      socket.data.role = "player";
      socket.data.pin = room.pin;

      io.to(room.hostSocketId).emit("players_update", roomManager.publicPlayers(room));
      cb({ ok: true, data: { pin: room.pin, quizTitle: room.quizTitle } });
    });

    /* ─── HOST: điều khiển ván ─────────────────────────────────────────── */

    const hostRoom = (): Room | null => {
      const room = roomManager.get(socket.data.pin);
      if (!room || room.hostSocketId !== socket.id) return null;
      return room;
    };

    socket.on("start_game", async () => {
      const room = hostRoom();
      if (!room || room.state !== "lobby" || room.players.size === 0) return;

      // Mỗi người chơi là một hàng `attempts` — cùng bảng với bài kiểm tra.
      if (room.sessionId) {
        try {
          for (const player of room.players.values()) {
            const attempt = await prisma.attempt.create({
              data: {
                quizId: room.quizId,
                userId: player.userId,
                sessionId: room.sessionId,
                guestName: player.userId ? null : player.name,
                mode: "LIVE",
                status: "IN_PROGRESS",
                totalQuestions: room.questions.length,
              },
            });
            player.attemptId = attempt.id;
          }
          persist(
            "session started",
            prisma.gameSession.update({
              where: { id: room.sessionId },
              data: { status: "IN_PROGRESS", startedAt: new Date() },
            })
          );
        } catch (err) {
          console.error("[realtime] Không tạo được attempts:", err);
        }
      }

      io.to(room.pin).emit("game_started");
      nextQuestion(io, room);
    });

    socket.on("next_question", () => {
      const room = hostRoom();
      if (room) nextQuestion(io, room);
    });

    socket.on("next_question_force_reveal", () => {
      const room = hostRoom();
      if (room) endQuestion(io, room);
    });

    socket.on("end_game", () => {
      const room = hostRoom();
      if (room) finishGame(io, room);
    });

    /* ─── NGƯỜI CHƠI: nộp đáp án ───────────────────────────────────────── */
    socket.on("submit_answer", (payload) => {
      const room = roomManager.get(socket.data.pin);
      if (!room || room.state !== "question") return;
      if (!room.players.has(socket.id)) return;
      if (room.currentAnswers.has(socket.id)) return; // chỉ một lần

      const parsed = submitAnswerSchema.safeParse(payload);
      if (!parsed.success) return;

      const question = roomManager.currentQuestion(room);
      if (!question || parsed.data.idx >= question.options.length) return;

      const elapsedMs = Date.now() - (room.questionStartAt ?? Date.now());
      room.currentAnswers.set(socket.id, { idx: parsed.data.idx, elapsedMs });
      socket.emit("answer_submitted");

      io.to(room.hostSocketId).emit("answers_progress", {
        answered: room.currentAnswers.size,
        total: room.players.size,
      });

      if (roomManager.everyoneAnswered(room)) endQuestion(io, room);
    });

    /* ─── Rời phòng ────────────────────────────────────────────────────── */
    const leave = () => {
      const pin = socket.data.pin;
      if (!pin) return;
      const room = roomManager.get(pin);
      if (!room) return;

      if (socket.data.role === "host") {
        io.to(pin).emit("host_left");
        if (room.sessionId && room.state !== "ended") {
          persist(
            "session abandoned",
            prisma.gameSession.update({
              where: { id: room.sessionId },
              data: { status: "ABANDONED", endedAt: new Date() },
            })
          );
        }
        roomManager.delete(pin);
      } else if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        io.to(room.hostSocketId).emit("players_update", roomManager.publicPlayers(room));
        io.to(pin).emit("leaderboard_updated", roomManager.publicPlayers(room));
      }
    };

    socket.on("leave_room", leave);
    socket.on("disconnect", leave);
  });
}

/* ─── Vòng đời câu hỏi ───────────────────────────────────────────────────── */

function nextQuestion(io: AppServer, room: Room): void {
  roomManager.clearTimer(room);
  room.currentIndex += 1;

  if (room.currentIndex >= room.questions.length) {
    finishGame(io, room);
    return;
  }

  room.state = "question";
  room.currentAnswers = new Map();
  room.questionStartAt = Date.now();

  const q = room.questions[room.currentIndex]!;

  // Chỉ gửi nội dung. correctIndex ở lại máy chủ cho tới lúc chốt câu.
  io.to(room.pin).emit("new_question", {
    index: room.currentIndex,
    total: room.questions.length,
    q: q.text,
    opts: q.options.map((o) => ({ text: o.text, color: o.color })),
    time_limit: q.timeLimit,
  });
  io.to(room.hostSocketId).emit("answers_progress", { answered: 0, total: room.players.size });

  // Hạn chót thật sự nằm ở đây; thanh đếm ngược phía client chỉ là hiệu ứng.
  room.timer = setTimeout(() => endQuestion(io, room), q.timeLimit * 1000 + SCORING.GRACE_MS);
}

function endQuestion(io: AppServer, room: Room): void {
  if (room.state !== "question") return;
  roomManager.clearTimer(room);
  room.state = "reveal";

  const q = room.questions[room.currentIndex]!;
  const results = [];
  const answerRows = [];

  for (const [socketId, player] of room.players) {
    const ans = room.currentAnswers.get(socketId);
    const correct = !!ans && ans.idx === q.correctIndex;

    const { gained, streak } = scoreLiveAnswer({
      correct,
      elapsedMs: ans?.elapsedMs ?? 0,
      timeLimitSec: q.timeLimit,
      previousStreak: player.streak,
    });

    player.streak = streak;
    player.score += gained;
    if (correct) player.correctCount += 1;

    results.push({
      id: socketId,
      name: player.name,
      correct,
      gained,
      score: player.score,
      chosen: ans ? ans.idx : null,
    });

    if (player.attemptId) {
      answerRows.push({
        attemptId: player.attemptId,
        questionId: q.id,
        selectedOptionId: ans ? (q.options[ans.idx]?.id ?? null) : null,
        isCorrect: correct,
        elapsedMs: ans?.elapsedMs ?? null,
        pointsAwarded: gained,
        streakAfter: streak,
      });
    }
  }

  if (answerRows.length > 0) {
    persist("attempt answers", prisma.attemptAnswer.createMany({ data: answerRows, skipDuplicates: true }));
  }

  // Gói tin đầu tiên — và duy nhất — mang đáp án đúng.
  io.to(room.pin).emit("question_result", {
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    img_correct: q.imageCorrect,
    img_wrong: q.imageWrong,
    results,
  });
  io.to(room.pin).emit("leaderboard_updated", roomManager.publicPlayers(room));
}

function finishGame(io: AppServer, room: Room): void {
  roomManager.clearTimer(room);
  room.state = "ended";

  const standings = roomManager.publicPlayers(room);
  io.to(room.pin).emit("game_finished", standings);

  const answered = room.currentIndex + 1;
  const now = new Date();
  const sessionId = room.sessionId;

  // Chụp lại trạng thái trước khi xoá phòng khỏi bộ nhớ.
  const finals = standings
    .map((entry, index) => {
      const player = room.players.get(entry.id);
      if (!player?.attemptId) return null;
      return {
        attemptId: player.attemptId,
        score: player.score,
        correctCount: player.correctCount,
        rank: index + 1,
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  /*
   * MỘT chuỗi tuần tự, không phải nhiều lời hứa chạy song song.
   * Trước đây phần cập nhật điểm và phần đếm lại số câu đúng là hai promise
   * riêng, nên chúng tranh nhau và correctCount có thể bị ghi đè về 0.
   */
  if (finals.length > 0 || sessionId) {
    persist(
      "game finished",
      (async () => {
        const maxScore = answered * maxLivePointsForQuestion();
        for (const f of finals) {
          await prisma.attempt.update({
            where: { id: f.attemptId },
            data: {
              status: "SUBMITTED",
              score: f.score,
              correctCount: f.correctCount,
              totalQuestions: answered,
              maxScore,
              rank: f.rank,
              submittedAt: now,
            },
          });
        }
        if (sessionId) {
          await prisma.gameSession.update({
            where: { id: sessionId },
            data: { status: "ENDED", endedAt: now },
          });
        }
      })()
    );
  }

  roomManager.delete(room.pin);
}
