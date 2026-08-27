/**
 * Danh mục âm của game.
 *
 * Tất cả đều dựng từ những viên gạch nhạc lý cơ bản — hợp âm ba nốt, quãng rải
 * đi lên/đi xuống, tiếng ồn lọc — chứ không chép giai điệu của ai. Đây là lý do
 * game có tiếng ngay mà không cần tệp nhạc nào và không dính bản quyền.
 */
import { LoopScheduler, audioNow, noiseBurst, tone } from "./synth.ts";
import type { LoopName } from "./resolve.ts";

/** Vài nốt hay dùng, theo Hz. */
const N = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  Fs5: 739.99,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
} as const;

/* ─── Âm kêu một tiếng ────────────────────────────────────────────────────── */

/** Bíp của 3 · 2 · 1. `remaining` là số đang hiện, càng gần 1 càng cao. */
export function playCountdown(remaining: number): void {
  const ladder = [N.A4, N.C5, N.E5];
  // remaining 3 → nốt thấp nhất, remaining 1 → nốt cao nhất.
  const idx = Math.min(Math.max(3 - remaining, 0), ladder.length - 1);
  tone({ freq: ladder[idx] ?? N.A4, duration: 0.16, type: "triangle", gain: 0.4 });
}

/** Tích tắc ở những giây cuối. `urgency` 0..1, càng cao càng đanh. */
export function playTick(urgency = 0): void {
  const u = Math.min(Math.max(urgency, 0), 1);
  noiseBurst({ duration: 0.035, gain: 0.12 + u * 0.16, cutoff: 1600 + u * 3200 });
  tone({ freq: 1200 + u * 700, duration: 0.03, type: "square", gain: 0.05 + u * 0.07 });
}

/** Trả lời đúng: hợp âm trưởng rải đi lên. */
export function playCorrect(): void {
  const t = audioNow();
  const notes = [N.C5, N.E5, N.G5, N.C6];
  notes.forEach((freq, i) => {
    tone({ freq, at: t + i * 0.07, duration: 0.22, type: "triangle", gain: 0.42 });
  });
}

/** Trả lời sai: hai nốt tụt xuống, hơi rè. */
export function playWrong(): void {
  const t = audioNow();
  tone({ freq: N.G4, at: t, duration: 0.2, type: "sawtooth", gain: 0.22 });
  tone({ freq: N.E4, at: t + 0.11, duration: 0.34, type: "sawtooth", gain: 0.2, glideTo: N.C4 });
}

/** Hết giờ: tiếng ù trầm kèm chút đục. */
export function playTimeout(): void {
  const t = audioNow();
  tone({ freq: 150, at: t, duration: 0.55, type: "sine", gain: 0.35, glideTo: 90 });
  tone({ freq: 151.5, at: t, duration: 0.55, type: "sine", gain: 0.22, glideTo: 88 });
  noiseBurst({ at: t, duration: 0.28, gain: 0.12, cutoff: 700 });
}

/** Có người vào phòng chờ. */
export function playJoin(): void {
  tone({ freq: N.E5, duration: 0.14, type: "sine", gain: 0.3, glideTo: N.A5 });
}

/** Công bố đáp án: một cú nhấn hợp âm. */
export function playReveal(): void {
  const t = audioNow();
  [N.C5, N.E5, N.G5].forEach((freq) => {
    tone({ freq, at: t, duration: 0.42, type: "triangle", gain: 0.3 });
  });
  noiseBurst({ at: t, duration: 0.1, gain: 0.14, cutoff: 5200 });
}

/** Kết thúc trận: chuỗi fanfare rồi giữ hợp âm. */
export function playPodium(): void {
  const t = audioNow();
  const run = [N.C5, N.E5, N.G5, N.C6, N.E6];
  run.forEach((freq, i) => {
    tone({ freq, at: t + i * 0.09, duration: 0.2, type: "triangle", gain: 0.4 });
  });
  const hold = t + run.length * 0.09;
  [N.C5, N.E5, N.G5, N.C6].forEach((freq) => {
    tone({ freq, at: hold, duration: 1.1, type: "triangle", gain: 0.26, attack: 0.02 });
  });
}

/* ─── Nhạc nền lặp ────────────────────────────────────────────────────────── */

/** Phòng chờ: rải nhẹ 8 bước, nghe thư thái. */
const LOBBY_PATTERN = [N.C5, N.E5, N.G5, N.E5, N.A4, N.C5, N.E5, N.C5] as const;

function renderLobby(time: number, step: number): void {
  const freq = LOBBY_PATTERN[step % LOBBY_PATTERN.length] ?? N.C5;
  tone({ freq, at: time, duration: 0.42, type: "sine", gain: 0.2, bus: "music", attack: 0.03 });
  // Nốt trầm giữ nhịp, hai bước một lần.
  if (step % 4 === 0) {
    tone({ freq: N.C4, at: time, duration: 0.8, type: "sine", gain: 0.16, bus: "music", attack: 0.04 });
  }
}

/** Đang trả lời: hai nốt trầm luân phiên, tạo cảm giác dồn. */
const SUSPENSE_PATTERN = [N.C4, N.G4, N.C4, N.B4] as const;

function renderSuspense(time: number, step: number): void {
  const freq = SUSPENSE_PATTERN[step % SUSPENSE_PATTERN.length] ?? N.C4;
  tone({ freq, at: time, duration: 0.3, type: "triangle", gain: 0.18, bus: "music" });
  if (step % 2 === 0) {
    noiseBurst({ at: time, duration: 0.05, gain: 0.05, cutoff: 900, bus: "music" });
  }
}

const LOOP_SPECS: Record<LoopName, { step: number; render: (t: number, s: number) => void }> = {
  lobby: { step: 0.36, render: renderLobby },
  suspense: { step: 0.4, render: renderSuspense },
};

const schedulers = new Map<LoopName, LoopScheduler>();

export function startSynthLoop(name: LoopName): void {
  let scheduler = schedulers.get(name);
  if (!scheduler) {
    const spec = LOOP_SPECS[name];
    scheduler = new LoopScheduler(spec.step, spec.render);
    schedulers.set(name, scheduler);
  }
  if (!scheduler.running) scheduler.start();
}

export function stopSynthLoop(name: LoopName): void {
  schedulers.get(name)?.stop();
}

export function stopAllSynthLoops(): void {
  for (const scheduler of schedulers.values()) scheduler.stop();
}

/** Bảng tra âm một tiếng, để `index.ts` gọi theo tên. */
export const ONE_SHOTS = {
  countdown: (arg?: number) => playCountdown(arg ?? 3),
  tick: (arg?: number) => playTick(arg ?? 0),
  correct: () => playCorrect(),
  wrong: () => playWrong(),
  timeout: () => playTimeout(),
  join: () => playJoin(),
  reveal: () => playReveal(),
  podium: () => playPodium(),
} as const;
