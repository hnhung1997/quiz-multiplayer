/**
 * Một kết nối socket duy nhất cho cả ứng dụng, mở khi cần và tự gắn access
 * token vào lúc bắt tay. Đăng nhập/đăng xuất thì nối lại để máy chủ thấy đúng
 * danh tính mới.
 */
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@quiz/shared";
import { getAccessToken } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket(): { socket: AppSocket | null; connected: boolean } {
  const { user, loading } = useAuth();
  const socketRef = useRef<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    // Chờ khôi phục phiên xong rồi mới nối, nếu không sẽ bắt tay khi chưa có token.
    if (loading) return;

    const socket: AppSocket = io({
      auth: { token: getAccessToken() ?? undefined },
      autoConnect: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;
    force((n) => n + 1);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // user?.id nằm trong deps để đăng nhập/đăng xuất thì nối lại với token mới.
  }, [loading, user?.id]);

  return { socket: socketRef.current, connected };
}
