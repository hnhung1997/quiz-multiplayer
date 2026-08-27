const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, extra = "") => { c ? pass++ : fail++; console.log(`  ${c ? "ok  " : "FAIL"}  ${n}${extra && !c ? "  → " + extra : ""}`); };

async function call(path: string, o: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(BASE + path, {
    method: o.method ?? "GET",
    headers: { ...(o.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) },
    ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
  });
  let json: any = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const login = async (id: string, pw: string) => (await call("/api/auth/login", { method: "POST", body: { identifier: id, password: pw } })).json?.accessToken as string;

const student = await login("student@quiz.local", "student123");
const teacher = await login("teacher@quiz.local", "teacher123");
const admin   = await login("admin@quiz.local", "change-me-now");

console.log("\n── PHÂN QUYỀN ──");
ok("cả 3 tài khoản seed đăng nhập được", !!student && !!teacher && !!admin);
ok("STUDENT bị chặn khỏi /api/admin/users (403)", (await call("/api/admin/users", { token: student })).status === 403);
ok("STUDENT không tạo được ngân hàng câu hỏi (403)", (await call("/api/banks", { method: "POST", body: { title: "X" }, token: student })).status === 403);
ok("TEACHER tạo được ngân hàng câu hỏi", [200, 201].includes((await call("/api/banks", { method: "POST", body: { title: "Bank E2E " + Date.now() }, token: teacher })).status));
ok("ADMIN xem được danh sách người dùng", (await call("/api/admin/users", { token: admin })).status === 200);
ok("ADMIN không tự đổi quyền mình được", (await call(`/api/admin/users/${(await call("/api/auth/me", { token: admin })).json.user.id}`, { method: "PATCH", body: { role: "STUDENT" }, token: admin })).status === 400);

console.log("\n── THƯ VIỆN ──");
const pub = await call("/api/quizzes?scope=public");
ok("khách chưa đăng nhập xem được quiz công khai", pub.status === 200 && pub.json.quizzes.length >= 1);
const quizId: string = pub.json.quizzes[0].id;
ok("quiz seed có 3 câu hỏi", pub.json.quizzes[0].questionCount === 3, String(pub.json.quizzes[0].questionCount));

console.log("\n── BẤT BIẾN ĐÁP ÁN (quan trọng nhất) ──");
const asStudent = await call(`/api/quizzes/${quizId}`, { token: student });
const studentJson = JSON.stringify(asStudent.json.questions);
ok("GET /quizzes/:id — học sinh KHÔNG nhận isCorrect", !studentJson.includes("isCorrect"));
ok("GET /quizzes/:id — canEdit=false cho học sinh", asStudent.json.canEdit === false);
const asOwner = await call(`/api/quizzes/${quizId}`, { token: teacher });
ok("GET /quizzes/:id — tác giả CÓ nhận isCorrect", JSON.stringify(asOwner.json.questions).includes("isCorrect"));

const start = await call("/api/attempts", { method: "POST", body: { quizId }, token: student });
ok("bắt đầu bài kiểm tra", [200, 201].includes(start.status), `status=${start.status} ${JSON.stringify(start.json)}`);
const paper = JSON.stringify(start.json.questions);
ok("ĐỀ BÀI không chứa 'isCorrect'", !paper.includes("isCorrect"));
ok("ĐỀ BÀI không chứa giá trị true nào", !paper.includes("true"));
ok("ĐỀ BÀI vẫn đủ 3 câu kèm đáp án để chọn", start.json.questions.length === 3 && start.json.questions.every((q: any) => q.options.length === 4));
ok("khách chưa đăng nhập KHÔNG làm bài được (401)", (await call("/api/attempts", { method: "POST", body: { quizId } })).status === 401);

console.log("\n── NỘP BÀI & CHẤM ──");
const attemptId: string = start.json.attemptId;
// Câu 1 chọn ô đầu, câu 2 chọn ô hai, câu 3 bỏ trống.
const answers = [
  { questionId: start.json.questions[0].id, optionId: start.json.questions[0].options[0].id },
  { questionId: start.json.questions[1].id, optionId: start.json.questions[1].options[1].id },
  { questionId: start.json.questions[2].id, optionId: null },
];
const submit = await call(`/api/attempts/${attemptId}/submit`, { method: "POST", body: { answers }, token: student });
ok("nộp bài trả về kết quả đã chấm", submit.status === 200 && !!submit.json.review);
const rev = submit.json.review;
ok("tổng số câu = 3 (câu bỏ trống vẫn được chấm)", rev.totalQuestions === 3, String(rev.totalQuestions));
ok("câu bỏ trống bị tính sai", rev.items.find((i: any) => i.selectedOptionId === null)?.isCorrect === false);
ok("kết quả CÓ đáp án đúng (bài đã nộp xong)", JSON.stringify(rev.items).includes("isCorrect"));
ok("điểm khớp số câu đúng", rev.score === rev.correctCount);
ok("có ghi thời gian làm bài", typeof rev.durationMs === "number");
ok("nộp lại lần hai bị chặn 409", (await call(`/api/attempts/${attemptId}/submit`, { method: "POST", body: { answers }, token: student })).status === 409);

console.log("\n── LỊCH SỬ & THỐNG KÊ ──");
const hist = await call("/api/me/attempts", { token: student });
ok("lượt làm bài xuất hiện trong lịch sử", hist.status === 200 && hist.json.attempts.some((a: any) => a.id === attemptId));
const stats = await call("/api/me/stats", { token: student });
ok("thống kê cá nhân tính được", stats.status === 200 && stats.json.stats.totalAttempts >= 1);
const ana = await call(`/api/quizzes/${quizId}/analytics`, { token: teacher });
ok("giáo viên xem được thống kê bộ quiz", ana.status === 200 && ana.json.analytics.attemptCount >= 1);
ok("thống kê có phân bố lựa chọn từng câu", ana.json.analytics.questions[0].distribution.length === 4);
ok("HỌC SINH không xem được thống kê (403)", (await call(`/api/quizzes/${quizId}/analytics`, { token: student })).status === 403);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} đạt, ${fail} hỏng`);
process.exit(fail === 0 ? 0 : 1);
