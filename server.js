// server.js
// Máy chủ multiplayer real-time cho Quiz Siêu Nhân.
// Server giữ toàn bộ trạng thái trận đấu, đáp án đúng và điểm số.
// Client (host & player) KHÔNG được tự tính điểm hay biết đáp án đúng trước khi câu hỏi kết thúc.

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // mở cho LAN/điện thoại; siết lại nếu deploy public
});

const PORT = process.env.PORT || 3000;
const DEFAULT_TIME_LIMIT = 15; // giây, khớp với TIME_LIMIT trong js.html
const MAX_PLAYERS_PER_ROOM = 200;
const NAME_MAX_LEN = 24;

app.use(express.static(path.join(__dirname, "public")));

// ---------- In-memory game state ----------
// rooms: Map<pin, Room>
// Room = {
//   pin, hostId, questions: [...], state: 'lobby'|'question'|'reveal'|'ended',
//   currentIndex, players: Map<socketId, Player>, timer, questionStartAt,
//   currentAnswers: Map<socketId, {idx, elapsed}>
// }
const rooms = new Map();

function genPin() {
  let pin;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(pin));
  return pin;
}

function sanitizeName(name) {
  return String(name || "")
    .trim()
    .slice(0, NAME_MAX_LEN)
    .replace(/[<>&"'`]/g, "");
}

function normalizeQuestion(raw) {
  const opts = Array.isArray(raw?.opts) ? raw.opts : [];
  return {
    q: String(raw?.q || "Câu hỏi trống"),
    opts: opts.slice(0, 6).map((o) => ({
      text: String(o?.text || "").slice(0, 120),
      color: typeof o?.color === "string" ? o.color : undefined,
    })),
    a: Number.isInteger(raw?.a) && raw.a < opts.length ? raw.a : 0,
    explanation: String(raw?.explanation || "").slice(0, 500),
    img_correct: String(raw?.img_correct || "dung.jpg"),
    img_wrong: String(raw?.img_wrong || "sai.jpg"),
    time_limit:
      Number.isInteger(raw?.time_limit) && raw.time_limit > 3 && raw.time_limit <= 120
        ? raw.time_limit
        : DEFAULT_TIME_LIMIT,
  };
}

function publicPlayers(room) {
  return Array.from(room.players.values())
    .map((p) => ({ id: p.id, name: p.name, score: p.score, connected: p.connected }))
    .sort((a, b) => b.score - a.score);
}

function getHostRoom(socket) {
  const room = rooms.get(socket.data.pin);
  if (!room || room.hostId !== socket.id) return null;
  return room;
}

function clearRoomTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function nextQuestion(room) {
  clearRoomTimer(room);
  room.currentIndex += 1;

  if (room.currentIndex >= room.questions.length) {
    finishGame(room);
    return;
  }

  room.state = "question";
  room.currentAnswers = new Map();
  room.questionStartAt = Date.now();
  const q = room.questions[room.currentIndex];

  // KHÔNG gửi đáp án đúng (q.a) cho client ở bước này.
  io.to(room.pin).emit("new_question", {
    index: room.currentIndex,
    total: room.questions.length,
    q: q.q,
    opts: q.opts.map((o) => ({ text: o.text, color: o.color })),
    time_limit: q.time_limit,
  });
  io.to(room.hostId).emit("answers_progress", { answered: 0, total: room.players.size });

  room.timer = setTimeout(() => endQuestion(room), q.time_limit * 1000 + 300);
}

function endQuestion(room) {
  if (room.state !== "question") return;
  clearRoomTimer(room);
  room.state = "reveal";
  const q = room.questions[room.currentIndex];

  const results = [];
  for (const [pid, player] of room.players) {
    const ans = room.currentAnswers.get(pid);
    let gained = 0;
    let correct = false;

    if (ans && ans.idx === q.a) {
      correct = true;
      const timeFrac = Math.max(0, 1 - ans.elapsed / (q.time_limit * 1000));
      // Base 500 + tối đa 500 điểm thưởng tốc độ (giống công thức Kahoot rút gọn)
      gained = Math.round(500 + 500 * timeFrac);
      player.streak = (player.streak || 0) + 1;
      gained += Math.min(player.streak - 1, 5) * 20; // thưởng chuỗi đúng, tối đa +100
    } else {
      player.streak = 0;
    }

    player.score += gained;
    results.push({
      id: pid,
      name: player.name,
      correct,
      gained,
      score: player.score,
      chosen: ans ? ans.idx : null,
    });
  }

  io.to(room.pin).emit("question_result", {
    correctIndex: q.a,
    explanation: q.explanation,
    img_correct: q.img_correct,
    img_wrong: q.img_wrong,
    results,
  });
  io.to(room.pin).emit("leaderboard_updated", publicPlayers(room));
}

function finishGame(room) {
  clearRoomTimer(room);
  room.state = "ended";
  io.to(room.pin).emit("game_finished", publicPlayers(room));
}

function leaveRoom(socket) {
  const pin = socket.data.pin;
  if (!pin) return;
  const room = rooms.get(pin);
  if (!room) return;

  if (socket.data.role === "host") {
    clearRoomTimer(room);
    io.to(pin).emit("host_left");
    rooms.delete(pin);
  } else if (room.players.has(socket.id)) {
    room.players.delete(socket.id);
    io.to(room.hostId).emit("players_update", publicPlayers(room));
    io.to(pin).emit("leaderboard_updated", publicPlayers(room));
  }
}

io.on("connection", (socket) => {
  socket.data.role = null;
  socket.data.pin = null;

  // ---- HOST: tạo phòng ----
  socket.on("create_room", (payload, cb) => {
    try {
      const rawQuestions = Array.isArray(payload?.questions) ? payload.questions : [];
      if (rawQuestions.length === 0) {
        return cb?.({ ok: false, error: "Chưa có câu hỏi nào để tạo phòng." });
      }
      const pin = genPin();
      const room = {
        pin,
        hostId: socket.id,
        questions: rawQuestions.map(normalizeQuestion),
        state: "lobby",
        currentIndex: -1,
        players: new Map(),
        timer: null,
        questionStartAt: null,
        currentAnswers: new Map(),
      };
      rooms.set(pin, room);
      socket.join(pin);
      socket.data.role = "host";
      socket.data.pin = pin;
      cb?.({ ok: true, pin, totalQuestions: room.questions.length });
    } catch (err) {
      cb?.({ ok: false, error: "Không thể tạo phòng." });
    }
  });

  // ---- PLAYER: tham gia bằng PIN ----
  socket.on("join_room", ({ pin, name } = {}, cb) => {
    const room = rooms.get(String(pin || "").trim());
    if (!room) return cb?.({ ok: false, error: "Mã PIN không tồn tại." });
    if (room.state !== "lobby") return cb?.({ ok: false, error: "Ván chơi đã bắt đầu, không thể vào thêm." });
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) return cb?.({ ok: false, error: "Phòng đã đầy." });

    const clean = sanitizeName(name);
    if (!clean) return cb?.({ ok: false, error: "Vui lòng nhập tên." });
    const dup = Array.from(room.players.values()).some(
      (p) => p.name.toLowerCase() === clean.toLowerCase()
    );
    if (dup) return cb?.({ ok: false, error: "Tên này đã có người dùng trong phòng." });

    room.players.set(socket.id, { id: socket.id, name: clean, score: 0, streak: 0, connected: true });
    socket.join(room.pin);
    socket.data.role = "player";
    socket.data.pin = room.pin;

    io.to(room.hostId).emit("players_update", publicPlayers(room));
    cb?.({ ok: true, pin: room.pin });
  });

  // ---- HOST: bắt đầu game ----
  socket.on("start_game", () => {
    const room = getHostRoom(socket);
    if (!room || room.state !== "lobby") return;
    if (room.players.size === 0) return;
    io.to(room.pin).emit("game_started");
    nextQuestion(room);
  });

  // ---- HOST: chốt câu hỏi hiện tại ngay (không chờ hết giờ) ----
  socket.on("next_question_force_reveal", () => {
    const room = getHostRoom(socket);
    if (!room) return;
    endQuestion(room);
  });

  // ---- HOST: sang câu tiếp theo ----
  socket.on("next_question", () => {
    const room = getHostRoom(socket);
    if (!room) return;
    nextQuestion(room);
  });

  // ---- HOST: kết thúc sớm ----
  socket.on("end_game", () => {
    const room = getHostRoom(socket);
    if (!room) return;
    finishGame(room);
  });

  // ---- PLAYER: nộp đáp án ----
  socket.on("submit_answer", ({ idx } = {}) => {
    const room = rooms.get(socket.data.pin);
    if (!room || room.state !== "question") return;
    if (!room.players.has(socket.id)) return;
    if (room.currentAnswers.has(socket.id)) return; // chỉ 1 lần

    const elapsed = Date.now() - room.questionStartAt;
    room.currentAnswers.set(socket.id, { idx: Number(idx), elapsed });
    socket.emit("answer_submitted");

    io.to(room.hostId).emit("answers_progress", {
      answered: room.currentAnswers.size,
      total: room.players.size,
    });

    if (room.currentAnswers.size >= room.players.size) {
      endQuestion(room); // mọi người đã trả lời -> chốt sớm, không cần chờ hết giờ
    }
  });

  socket.on("leave_room", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

server.listen(PORT, () => {
  console.log(`✅ Quiz multiplayer server đang chạy tại http://localhost:${PORT}`);
});
