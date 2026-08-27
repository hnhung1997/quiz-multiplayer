/**
 * API âm thanh công khai. Các trang chỉ nên import từ đây.
 *
 * Mặc định mọi âm đều do `synth.ts` sinh ra. Nếu người dùng khai báo tệp trong
 * `public/sounds/manifest.json` thì tên đó chuyển sang dùng tệp thật.
 */
import {
  LOOP_NAMES,
  parseManifest,
  resolveSource,
  SOUNDS_BASE,
  type LoopName,
  type SoundManifest,
  type SoundName,
} from "./resolve.ts";
import { ONE_SHOTS, startSynthLoop, stopAllSynthLoops, stopSynthLoop } from "./sounds.ts";
import {
  decodeAudio,
  playBuffer,
  resumeAudio,
  setMuted,
  stopEverything,
} from "./synth.ts";

let manifest: SoundManifest = {};
let manifestLoaded = false;
let enabled = false;

const buffers = new Map<SoundName, AudioBuffer>();
const stopFns = new Map<LoopName, () => void>();

/**
 * Nạp manifest một lần. Tệp `manifest.json` luôn tồn tại (mặc định là `{}`) nên
 * bình thường không sinh lỗi 404 nào ở console.
 */
export async function loadSoundManifest(): Promise<void> {
  if (manifestLoaded) return;
  manifestLoaded = true;

  try {
    const res = await fetch(`${SOUNDS_BASE}manifest.json`);
    if (!res.ok) return;
    manifest = parseManifest(await res.json());
  } catch {
    // Không có manifest hoặc JSON hỏng — cứ dùng âm tổng hợp.
    manifest = {};
  }

  // Giải mã trước những tệp được khai báo, để lúc cần phát là kêu ngay.
  await Promise.all(
    (Object.keys(manifest) as SoundName[]).map(async (name) => {
      const source = resolveSource(name, manifest);
      if (source.kind !== "file") return;
      const buffer = await decodeAudio(source.url);
      if (buffer) buffers.set(name, buffer);
    })
  );
}

/** Đánh thức AudioContext sau thao tác đầu tiên của người dùng. */
export function primeAudio(): void {
  resumeAudio();
}

export function setAudioEnabled(on: boolean): void {
  enabled = on;
  setMuted(!on);
  // Tắt tiếng thì dừng hẳn vòng lặp, không để nó chạy câm tốn CPU.
  if (!on) stopAllLoops();
}

export function isAudioEnabled(): boolean {
  return enabled;
}

/** Phát một tiếng. `arg` dùng cho vài âm có tham số (countdown, tick). */
export function play(name: Exclude<SoundName, LoopName>, arg?: number): void {
  if (!enabled) return;

  const buffer = buffers.get(name);
  if (buffer) {
    playBuffer(buffer, { bus: "sfx" });
    return;
  }

  ONE_SHOTS[name]?.(arg);
}

export function startLoop(name: LoopName): void {
  if (!enabled || stopFns.has(name)) return;

  const buffer = buffers.get(name);
  if (buffer) {
    const stop = playBuffer(buffer, { loop: true, bus: "music" });
    if (stop) stopFns.set(name, stop);
    return;
  }

  startSynthLoop(name);
  stopFns.set(name, () => stopSynthLoop(name));
}

export function stopLoop(name: LoopName): void {
  const stop = stopFns.get(name);
  if (stop) {
    stop();
    stopFns.delete(name);
  }
  stopSynthLoop(name);
}

export function stopAllLoops(): void {
  for (const name of LOOP_NAMES) stopLoop(name);
  stopAllSynthLoops();
}

/** Dừng sạch mọi thứ đang kêu. Dùng khi rời trang. */
export function stopAllAudio(): void {
  stopAllLoops();
  stopEverything();
}

export type { LoopName, SoundName } from "./resolve.ts";
