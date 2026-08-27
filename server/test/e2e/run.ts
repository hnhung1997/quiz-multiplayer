/**
 * Chạy toàn bộ kiểm thử đầu-cuối.
 *
 * Khác với `npm test` (thuần logic, không cần gì), bộ này cần MỘT MÁY CHỦ ĐANG
 * CHẠY và CSDL đã seed, vì nó gọi HTTP + socket thật.
 *
 *   npm start &        (hoặc npm run dev)
 *   npm run test:e2e
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const health = await fetch(BASE + "/api/health").catch(() => null);
if (!health?.ok) {
  console.error(
    `❌ Không thấy máy chủ ở ${BASE}.\n` +
      `   Chạy \`npm start\` (hoặc \`npm run dev\`) ở một cửa sổ khác rồi thử lại.`
  );
  process.exit(1);
}
const body = (await health.json()) as { db?: string };
if (body.db !== "up") {
  console.error("❌ Máy chủ chạy nhưng không kết nối được CSDL. Kiểm tra DATABASE_URL.");
  process.exit(1);
}

const suites = ["auth.e2e.ts", "access.e2e.ts", "test-mode.e2e.ts", "live.e2e.ts"];
let failed = 0;

for (const suite of suites) {
  console.log(`\n${"═".repeat(50)}\n  ${suite}\n${"═".repeat(50)}`);
  const code = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, [path.join(here, suite)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (c) => resolve(c ?? 1));
  });
  if (code !== 0) failed++;
}

console.log(
  failed === 0
    ? `\n✅ Tất cả ${suites.length} bộ kiểm thử đầu-cuối đều đạt`
    : `\n❌ ${failed}/${suites.length} bộ thất bại`
);
process.exit(failed === 0 ? 0 : 1);
