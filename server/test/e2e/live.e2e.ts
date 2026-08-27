import { io, type Socket } from "socket.io-client";
import { prisma } from "../../src/db/prisma.ts";

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, extra = "") => { c ? pass++ : fail++; console.log(`  ${c ? "ok  " : "FAIL"}  ${n}${extra && !c ? "  → " + extra : ""}`); };

async function login(id: string, pw: string): Promise<string> {
  const r = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: id, password: pw }) });
  return (await r.json() as any).accessToken;
}
const connect = (token?: string): Promise<Socket> =>
  new Promise((res, rej) => {
    const s = io(BASE, { auth: token ? { token } : {}, transports: ["websocket"], forceNew: true });
    s.on("connect", () => res(s));
    s.on("connect_error", rej);
  });
const emitAck = <T,>(s: Socket, ev: string, payload: unknown): Promise<T> =>
  new Promise((res) => s.emit(ev, payload, res as (v: T) => void));
const waitFor = <T,>(s: Socket, ev: string, ms = 8000): Promise<T> =>
  new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout " + ev)), ms); s.once(ev, (d: T) => { clearTimeout(t); res(d); }); });

const teacherTok = await login("teacher@quiz.local", "teacher123");
const studentTok = await login("student@quiz.local", "student123");
const quizId: string = (await (await fetch(BASE + "/api/quizzes?scope=public")).json() as any).quizzes[0].id;

console.log("\n── MỞ PHÒNG & PHÂN QUYỀN ──");
const guestSock = await connect();
const badCreate = await emitAck<any>(guestSock, "create_room", { quizId });
ok("khách KHÔNG mở được phòng", badCreate.ok === false, JSON.stringify(badCreate));

const studentSock = await connect(studentTok);
const studentCreate = await emitAck<any>(studentSock, "create_room", { quizId });
ok("HỌC SINH KHÔNG mở được phòng (đây là lỗ hổng của bản cũ)", studentCreate.ok === false, JSON.stringify(studentCreate));

const hostSock = await connect(teacherTok);
const created = await emitAck<any>(hostSock, "create_room", { quizId });
ok("GIÁO VIÊN mở được phòng", created.ok === true, JSON.stringify(created));
const pin: string = created.data.pin;
ok("PIN gồm 6 chữ số", /^\d{6}$/.test(pin), pin);
ok("trả về đúng số câu hỏi", created.data.totalQuestions === 3);

console.log("\n── VÀO PHÒNG ──");
const j1 = await emitAck<any>(studentSock, "join_room", { pin, name: "Học Sinh Demo" });
ok("người đã đăng nhập vào được phòng", j1.ok === true, JSON.stringify(j1));
const j2 = await emitAck<any>(guestSock, "join_room", { pin, name: "Khách Vãng Lai" });
ok("KHÁCH vẫn vào được phòng bằng PIN", j2.ok === true, JSON.stringify(j2));
const dupSock = await connect();
const j3 = await emitAck<any>(dupSock, "join_room", { pin, name: "học sinh demo" });
ok("tên trùng (không phân biệt hoa/thường) bị từ chối", j3.ok === false, JSON.stringify(j3));
const j4 = await emitAck<any>(dupSock, "join_room", { pin: "000000", name: "Ai Đó" });
ok("PIN không tồn tại bị từ chối", j4.ok === false);

console.log("\n── BẤT BIẾN TRÊN ĐƯỜNG TRUYỀN ──");
const q1p = waitFor<any>(studentSock, "new_question");
hostSock.emit("start_game");
const q1 = await q1p;
const wire = JSON.stringify(q1);
ok("new_question KHÔNG chứa 'a' (chỉ số đáp án)", q1.a === undefined);
ok("new_question KHÔNG chứa 'correctIndex'", !wire.includes("correctIndex"));
ok("new_question KHÔNG chứa 'isCorrect'", !wire.includes("isCorrect"));
ok("new_question có đủ nội dung để chơi", !!q1.q && q1.opts.length === 4 && q1.time_limit > 0);

const resP = waitFor<any>(studentSock, "question_result");
studentSock.emit("submit_answer", { idx: 0 });
guestSock.emit("submit_answer", { idx: 1 });
const res1 = await resP;
ok("question_result LÀ gói tin đầu tiên mang correctIndex", typeof res1.correctIndex === "number");
ok("kết quả có dòng cho cả hai người chơi", res1.results.length === 2, String(res1.results.length));
ok("chấm đúng theo đáp án thật", res1.results.find((r: any) => r.chosen === res1.correctIndex)?.correct === true);
ok("điểm nằm trong khoảng công thức (500..1100)", res1.results.filter((r: any) => r.correct).every((r: any) => r.gained >= 500 && r.gained <= 1100));

console.log("\n── CHƠI HẾT VÁN ──");
for (let i = 2; i <= 3; i++) {
  const qp = waitFor<any>(studentSock, "new_question");
  hostSock.emit("next_question");
  await qp;
  const rp = waitFor<any>(studentSock, "question_result");
  studentSock.emit("submit_answer", { idx: 0 });
  guestSock.emit("submit_answer", { idx: 0 });
  await rp;
}
const finishedP = waitFor<any>(studentSock, "game_finished");
hostSock.emit("next_question");
const standings = await finishedP;
ok("game_finished trả bảng xếp hạng", Array.isArray(standings) && standings.length === 2);
ok("bảng xếp hạng sắp theo điểm giảm dần", standings[0].score >= standings[1].score);

console.log("\n── LƯU KẾT QUẢ ──");
await new Promise((r) => setTimeout(r, 2500)); // ghi CSDL diễn ra ở mốc kết thúc, không chặn ván
const session = await prisma.gameSession.findFirst({ where: { pin }, orderBy: { createdAt: "desc" }, include: { attempts: { include: { answers: true } } } });
ok("phiên chơi được lưu", !!session);
ok("phiên ở trạng thái ENDED", session?.status === "ENDED", session?.status);
ok("lưu 2 lượt chơi (1 tài khoản + 1 khách)", session?.attempts.length === 2, String(session?.attempts.length));
const linked = session?.attempts.find((a) => a.userId !== null);
const guest = session?.attempts.find((a) => a.userId === null);
ok("lượt của người đăng nhập gắn với userId", !!linked);
ok("lượt của khách có guestName, không có userId", !!guest && guest.guestName === "Khách Vãng Lai");
ok("mỗi lượt có 3 câu trả lời được ghi", session?.attempts.every((a) => a.answers.length === 3) === true, session?.attempts.map(a => a.answers.length).join(","));
ok("có xếp hạng cuối", session?.attempts.every((a) => a.rank !== null) === true);
ok("correctCount được tính lại từ dữ liệu đã ghi", session?.attempts.every((a) => a.correctCount === a.answers.filter((x) => x.isCorrect).length) === true);
ok("mode = LIVE", session?.attempts.every((a) => a.mode === "LIVE") === true);

// Lượt LIVE phải hiện trong lịch sử tài khoản, chung đường với bài kiểm tra.
const hist = await (await fetch(BASE + "/api/me/attempts", { headers: { Authorization: `Bearer ${studentTok}` } })).json() as any;
ok("lượt chơi nhóm hiện trong lịch sử tài khoản", hist.attempts.some((a: any) => a.mode === "LIVE"));

for (const s of [hostSock, studentSock, guestSock, dupSock]) s.disconnect();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} đạt, ${fail} hỏng`);
process.exit(fail === 0 ? 0 : 1);
