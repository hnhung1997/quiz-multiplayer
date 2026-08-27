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

// Học sinh thứ hai, hoàn toàn không liên quan tới bài của người kia.
const u = Date.now().toString().slice(-8);
const other = (await call("/api/auth/register", { method: "POST", body: { email: `other${u}@t.local`, username: `other${u}`, password: "matkhau12345", displayName: "Người khác" } })).json.accessToken as string;

const quizId: string = (await call("/api/quizzes?scope=public")).json.quizzes[0].id;
const start = await call("/api/attempts", { method: "POST", body: { quizId }, token: student });
const attemptId: string = start.json.attemptId;
await call(`/api/attempts/${attemptId}/submit`, { method: "POST", body: { answers: start.json.questions.map((q: any) => ({ questionId: q.id, optionId: q.options[0].id })) }, token: student });

console.log("\n── QUYỀN XEM BÀI LÀM ──");
ok("chủ bài xem được bài của mình", (await call(`/api/attempts/${attemptId}`, { token: student })).status === 200);
ok("HỌC SINH KHÁC bị chặn (403)", (await call(`/api/attempts/${attemptId}`, { token: other })).status === 403, `status=${(await call(`/api/attempts/${attemptId}`, { token: other })).status}`);
ok("chưa đăng nhập bị chặn (401)", (await call(`/api/attempts/${attemptId}`)).status === 401);
ok("tác giả bộ quiz xem được (để chấm/hỗ trợ)", (await call(`/api/attempts/${attemptId}`, { token: teacher })).status === 200);

console.log("\n── QUIZ RIÊNG TƯ ──");
const priv = await call("/api/quizzes", { method: "POST", body: { title: "Riêng tư " + u, visibility: "PRIVATE", isPublished: false }, token: teacher });
const privId: string = priv.json.quiz.id;
ok("tác giả xem được quiz riêng tư của mình", (await call(`/api/quizzes/${privId}`, { token: teacher })).status === 200);
ok("người khác KHÔNG xem được quiz riêng tư (403)", (await call(`/api/quizzes/${privId}`, { token: other })).status === 403);
ok("khách KHÔNG xem được quiz riêng tư (403)", (await call(`/api/quizzes/${privId}`)).status === 403);
ok("quiz riêng tư KHÔNG lộ trong thư viện công khai", !(await call("/api/quizzes?scope=public")).json.quizzes.some((q: any) => q.id === privId));
ok("người khác KHÔNG làm bài quiz riêng tư được (403)", (await call("/api/attempts", { method: "POST", body: { quizId: privId }, token: other })).status === 403);
ok("người khác KHÔNG sửa được quiz của tác giả (403)", (await call(`/api/quizzes/${privId}`, { method: "PATCH", body: { title: "Chiếm quyền" }, token: other })).status === 403);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} đạt, ${fail} hỏng`);
process.exit(fail === 0 ? 0 : 1);
