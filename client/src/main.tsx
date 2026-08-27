import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { AudioProvider } from "@/providers/audio-provider";
import { App } from "@/App";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Không tìm thấy #root");

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* AudioProvider nằm trong Router vì nó đọc đường dẫn để quyết định
              mặc định bật hay tắt tiếng cho từng màn. */}
          <AudioProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </AudioProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);
