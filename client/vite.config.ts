import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    // Nguồn TypeScript phải được ưu tiên. Mặc định Vite thử ".js" trước ".tsx",
    // nên một file .js lỡ bị biên dịch ra sẽ âm thầm che mất file .tsx thật.
    extensions: [".tsx", ".ts", ".mts", ".jsx", ".mjs", ".js", ".json"],
  },
  server: {
    port: 5173,
    // API và socket đi thẳng sang Express, nên trình duyệt luôn thấy cùng origin
    // (cookie refresh nhờ vậy hoạt động y như lúc chạy thật).
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:3000", ws: true, changeOrigin: true },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
