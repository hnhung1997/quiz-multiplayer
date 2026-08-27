const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const ok  = (n: string, c: boolean, extra = "") => { c ? pass++ : fail++; console.log(`  ${c ? "ok  " : "FAIL"}  ${n}${extra && !c ? "  → " + extra : ""}`); };

/** Giữ cookie thủ công để mô phỏng trình duyệt. */
function jar() {
  let cookie = "";
  return {
    get cookie() { return cookie; },
    capture(res: Response) {
      const sc = res.headers.getSetCookie?.() ?? [];
      for (const c of sc) {
        const [pair] = c.split(";");
        if (pair?.startsWith("qsn_refresh=")) cookie = pair;
      }
      return res;
    },
  };
}

async function call(path: string, opts: { method?: string; body?: unknown; token?: string; cookie?: string } = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  let json: any = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, res };
}

console.log("\n── ĐĂNG KÝ / ĐĂNG NHẬP ──");
const uniq = Date.now().toString().slice(-8);
const cj = jar();

const reg = await fetch(BASE + "/api/auth/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: `e2e${uniq}@test.local`, username: `e2e${uniq}`, password: "matkhau12345", displayName: "E2E Tester" }),
});
cj.capture(reg);
const regBody: any = await reg.json();
ok("đăng ký trả 201 + accessToken", reg.status === 201 && !!regBody.accessToken, `status=${reg.status}`);
ok("người đăng ký mới mặc định là STUDENT", regBody.user?.role === "STUDENT", regBody.user?.role);
ok("refresh cookie được đặt httpOnly", (reg.headers.getSetCookie?.() ?? []).some(c => c.includes("HttpOnly")));
ok("mật khẩu không bao giờ nằm trong phản hồi", !JSON.stringify(regBody).toLowerCase().includes("matkhau"));

const dup = await call("/api/auth/register", { method: "POST", body: { email: `e2e${uniq}@test.local`, username: "khac" + uniq, password: "matkhau12345", displayName: "X" } });
ok("email trùng bị chặn 409", dup.status === 409, `status=${dup.status}`);

const badLogin = await call("/api/auth/login", { method: "POST", body: { identifier: `e2e${uniq}@test.local`, password: "sai-mat-khau" } });
ok("sai mật khẩu → 401", badLogin.status === 401);
const noUser = await call("/api/auth/login", { method: "POST", body: { identifier: "khongtontai@test.local", password: "gi-do-12345" } });
ok("thông báo giống nhau cho 'không có tài khoản' và 'sai mật khẩu'", noUser.json?.error === badLogin.json?.error);

const login = await fetch(BASE + "/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: `e2e${uniq}@test.local`, password: "matkhau12345" }),
});
cj.capture(login);
const loginBody: any = await login.json();
let token: string = loginBody.accessToken;
ok("đăng nhập bằng email", login.status === 200 && !!token);

const byUsername = await call("/api/auth/login", { method: "POST", body: { identifier: `e2e${uniq}`, password: "matkhau12345" } });
ok("đăng nhập bằng tên đăng nhập", byUsername.status === 200);

const me = await call("/api/auth/me", { token });
ok("GET /me trả đúng người dùng", me.status === 200 && me.json?.user?.username === `e2e${uniq}`);
ok("GET /me không kèm passwordHash", !JSON.stringify(me.json).includes("passwordHash"));

console.log("\n── XOAY VÒNG & THU HỒI TOKEN ──");
const firstCookie = cj.cookie;
const r1 = await fetch(BASE + "/api/auth/refresh", { method: "POST", headers: { Cookie: firstCookie } });
cj.capture(r1);
const r1Body: any = await r1.json();
ok("refresh cấp access token mới", r1.status === 200 && !!r1Body.accessToken);
ok("refresh cookie đã xoay (khác token cũ)", cj.cookie !== firstCookie);
token = r1Body.accessToken;

// Dùng lại token đã xoay → phải bị coi là bị đánh cắp.
const reuse = await call("/api/auth/refresh", { method: "POST", cookie: firstCookie });
ok("dùng lại refresh token cũ bị chặn 401", reuse.status === 401, `status=${reuse.status}`);
const afterReuse = await call("/api/auth/refresh", { method: "POST", cookie: cj.cookie });
ok("phát hiện dùng lại → thu hồi CẢ CHUỖI (token hiện tại cũng chết)", afterReuse.status === 401, `status=${afterReuse.status}`);

// Đăng nhập lại rồi kiểm tra đăng xuất.
const relog = await fetch(BASE + "/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: `e2e${uniq}@test.local`, password: "matkhau12345" }),
});
cj.capture(relog);
token = (await relog.json() as any).accessToken;
const logout = await call("/api/auth/logout", { method: "POST", cookie: cj.cookie });
ok("đăng xuất trả 200", logout.status === 200);
const afterLogout = await call("/api/auth/refresh", { method: "POST", cookie: cj.cookie });
ok("sau đăng xuất, refresh bị từ chối 401 (đăng xuất có thật)", afterLogout.status === 401, `status=${afterLogout.status}`);

console.log(`\n${fail === 0 ? "✅" : "❌"} auth: ${pass} đạt, ${fail} hỏng`);
process.exit(fail === 0 ? 0 : 1);
