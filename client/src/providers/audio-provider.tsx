import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  loadSoundManifest,
  primeAudio,
  setAudioEnabled,
  stopAllAudio,
} from "@/lib/audio";

/**
 * `auto` = chưa chọn gì, để từng màn tự quyết. Nhờ vậy chỉ cần MỘT khoá lưu mà
 * vẫn có mặc định khác nhau: màn host và chơi một mình có tiếng, còn điện thoại
 * người chơi thì im (30 máy cùng phát nhạc lệch nhịp trong một phòng nghe rất tệ).
 */
export type SoundPreference = "on" | "off" | "auto";

const STORAGE_KEY = "qsn-sound";

/** Những đường dẫn mặc định im khi người dùng chưa tự chọn. */
const QUIET_BY_DEFAULT = ["/play", "/test"];

interface AudioContextValue {
  preference: SoundPreference;
  /** Kết quả cuối cùng sau khi quy đổi `auto` theo màn đang mở. */
  enabled: boolean;
  setPreference: (next: SoundPreference) => void;
  toggle: () => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

function readStored(): SoundPreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "on" || v === "off" || v === "auto") return v;
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư) — cứ dùng mặc định.
  }
  return "auto";
}

function defaultForPath(pathname: string): boolean {
  return !QUIET_BY_DEFAULT.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<SoundPreference>(readStored);
  const { pathname } = useLocation();

  const enabled = preference === "auto" ? defaultForPath(pathname) : preference === "on";

  // Manifest nạp một lần cho cả phiên; không có tệp nào thì đây là việc rất rẻ.
  useEffect(() => {
    void loadSoundManifest();
  }, []);

  useEffect(() => {
    setAudioEnabled(enabled);
  }, [enabled]);

  /*
   * Trình duyệt giữ AudioContext ở trạng thái "suspended" cho tới khi có thao
   * tác thật. Mọi chỗ phát âm trong game đều đứng sau một cú bấm nên thực tế
   * không chạm giới hạn này — đây chỉ là lưới an toàn, chạy đúng một lần.
   */
  useEffect(() => {
    const wake = () => primeAudio();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // Rời hẳn ứng dụng thì không để tiếng nào rớt lại.
  useEffect(() => stopAllAudio, []);

  const setPreference = useCallback((next: SoundPreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Không lưu được thì vẫn đổi cho phiên hiện tại.
    }
  }, []);

  // Bấm nút loa là chốt lựa chọn rõ ràng, thoát khỏi trạng thái "auto".
  const toggle = useCallback(() => {
    setPreference(enabled ? "off" : "on");
  }, [enabled, setPreference]);

  const value = useMemo(
    () => ({ preference, enabled, setPreference, toggle }),
    [preference, enabled, setPreference, toggle]
  );

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio phải nằm trong <AudioProvider>");
  return ctx;
}
