/**
 * Lớp bọc mỏng quanh Web Audio API.
 *
 * Toàn bộ âm trong game do đây sinh ra — không dùng tệp nhạc có bản quyền của
 * bên nào. Các giai điệu ở `sounds.ts` là hợp âm rải và quãng đơn giản tự soạn.
 *
 * Hai điểm quan trọng:
 *  1. AudioContext tạo LƯỜI. Tạo lúc tải trang thì trình duyệt cho ra trạng
 *     thái "suspended" và ghi cảnh báo ở console.
 *  2. Mọi thứ hẹn giờ theo `ctx.currentTime` (đồng hồ âm thanh), không theo
 *     `Date.now()`. Đồng hồ âm thanh không bị tab chạy nền bóp méo.
 */

type Ctx = AudioContext;

interface Buses {
  ctx: Ctx;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
}

const MASTER_GAIN = 0.35;
/** Nhạc nền nhỏ hơn hiệu ứng để không át tiếng đúng/sai. */
const MUSIC_GAIN = 0.45;
const SFX_GAIN = 1;

let buses: Buses | null = null;
let muted = false;

function createBuses(): Buses | null {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  let ctx: Ctx;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }

  const master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_GAIN;
  master.connect(ctx.destination);

  const sfx = ctx.createGain();
  sfx.gain.value = SFX_GAIN;
  sfx.connect(master);

  const music = ctx.createGain();
  music.gain.value = MUSIC_GAIN;
  music.connect(master);

  return { ctx, master, sfx, music };
}

/** Lấy (và nếu cần thì tạo) đồ nghề âm thanh. Trả null nếu trình duyệt không hỗ trợ. */
export function getBuses(): Buses | null {
  if (!buses) buses = createBuses();
  return buses;
}

/** Đánh thức AudioContext. Phải gọi sau một thao tác thật của người dùng. */
export function resumeAudio(): void {
  const b = getBuses();
  if (b && b.ctx.state === "suspended") void b.ctx.resume();
}

export function isMuted(): boolean {
  return muted;
}

/**
 * Bật/tắt tiếng. Dùng dốc ngắn thay vì gán thẳng để không nghe "bụp" khi cắt
 * giữa lúc nhạc nền đang chạy.
 */
export function setMuted(next: boolean): void {
  muted = next;
  const b = buses;
  if (!b) return;
  const t = b.ctx.currentTime;
  b.master.gain.cancelScheduledValues(t);
  b.master.gain.setValueAtTime(b.master.gain.value, t);
  b.master.gain.linearRampToValueAtTime(next ? 0 : MASTER_GAIN, t + 0.06);
}

export function audioNow(): number {
  return getBuses()?.ctx.currentTime ?? 0;
}

export type Bus = "sfx" | "music";

export interface ToneOptions {
  freq: number;
  /** Thời điểm bắt đầu theo đồng hồ âm thanh. Bỏ trống là ngay bây giờ. */
  at?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  bus?: Bus;
  /** Trượt tới tần số này trong lúc kêu — dùng cho tiếng bloop. */
  glideTo?: number;
  attack?: number;
}

/** Theo dõi node đang kêu để dừng ngay được khi rời trang hoặc tắt vòng lặp. */
const live = new Set<{ stop: (when?: number) => void }>();

/** Một nốt: dao động + đường bao lên/xuống. */
export function tone(opts: ToneOptions): void {
  const b = getBuses();
  if (!b) return;

  const start = opts.at ?? b.ctx.currentTime;
  const duration = opts.duration ?? 0.18;
  const attack = Math.min(opts.attack ?? 0.008, duration * 0.5);
  const peak = opts.gain ?? 0.5;

  const osc = b.ctx.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.glideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(opts.glideTo, 1), start + duration);
  }

  const env = b.ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env);
  env.connect(opts.bus === "music" ? b.music : b.sfx);

  osc.start(start);
  osc.stop(start + duration + 0.02);

  const handle = { stop: (when?: number) => { try { osc.stop(when ?? 0); } catch { /* đã dừng */ } } };
  live.add(handle);
  osc.onended = () => {
    live.delete(handle);
    env.disconnect();
    osc.disconnect();
  };
}

export interface NoiseOptions {
  at?: number;
  duration?: number;
  gain?: number;
  bus?: Bus;
  /** Lọc thông thấp, Hz. Thấp thì nghe trầm đục, cao thì sắc như tiếng "xì". */
  cutoff?: number;
}

/** Tiếng ồn trắng ngắn — dùng cho tiếng tích tắc và phần đục của tiếng hết giờ. */
export function noiseBurst(opts: NoiseOptions = {}): void {
  const b = getBuses();
  if (!b) return;

  const start = opts.at ?? b.ctx.currentTime;
  const duration = opts.duration ?? 0.05;
  const frames = Math.max(1, Math.floor(b.ctx.sampleRate * duration));

  const buffer = b.ctx.createBuffer(1, frames, b.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = b.ctx.createBufferSource();
  src.buffer = buffer;

  const filter = b.ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = opts.cutoff ?? 2200;

  const env = b.ctx.createGain();
  const peak = opts.gain ?? 0.25;
  env.gain.setValueAtTime(peak, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  src.connect(filter);
  filter.connect(env);
  env.connect(opts.bus === "music" ? b.music : b.sfx);

  src.start(start);

  const handle = { stop: (when?: number) => { try { src.stop(when ?? 0); } catch { /* đã dừng */ } } };
  live.add(handle);
  src.onended = () => {
    live.delete(handle);
    env.disconnect();
    filter.disconnect();
    src.disconnect();
  };
}

/** Phát một đoạn đã giải mã sẵn (khi người dùng có cắm tệp nhạc). */
export function playBuffer(buffer: AudioBuffer, opts: { loop?: boolean; bus?: Bus } = {}): (() => void) | null {
  const b = getBuses();
  if (!b) return null;

  const src = b.ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = opts.loop ?? false;
  src.connect(opts.bus === "music" ? b.music : b.sfx);
  src.start();

  const handle = { stop: (when?: number) => { try { src.stop(when ?? 0); } catch { /* đã dừng */ } } };
  live.add(handle);
  src.onended = () => {
    live.delete(handle);
    src.disconnect();
  };

  return () => {
    handle.stop();
    live.delete(handle);
  };
}

export async function decodeAudio(url: string): Promise<AudioBuffer | null> {
  const b = getBuses();
  if (!b) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await b.ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Dừng mọi thứ đang kêu. Dùng khi rời trang. */
export function stopEverything(): void {
  for (const handle of live) handle.stop();
  live.clear();
}

/* ─── Bộ lên lịch cho nhạc nền lặp ────────────────────────────────────────── */

/**
 * Mẫu "hai đồng hồ": một bộ đếm thô của trình duyệt thức dậy đều đặn, nhưng
 * mọi nốt đều được hẹn trước theo đồng hồ âm thanh.
 *
 * Nhìn trước 1,5 giây là có chủ đích: tab chạy nền bị bóp `setInterval` xuống
 * còn ~1 lần/giây, nhìn trước ngắn hơn sẽ để lọt nốt và nghe thủng lỗ.
 */
const LOOKAHEAD_SECONDS = 1.5;
const SCHEDULER_TICK_MS = 250;

export class LoopScheduler {
  private readonly stepSeconds: number;
  private readonly render: (time: number, step: number) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;

  constructor(stepSeconds: number, render: (time: number, step: number) => void) {
    this.stepSeconds = stepSeconds;
    this.render = render;
  }

  start(): void {
    const b = getBuses();
    if (!b || this.timer !== null) return;

    this.nextTime = b.ctx.currentTime + 0.05;
    this.step = 0;

    const pump = () => {
      const bus = getBuses();
      if (!bus) return;
      while (this.nextTime < bus.ctx.currentTime + LOOKAHEAD_SECONDS) {
        this.render(this.nextTime, this.step);
        this.nextTime += this.stepSeconds;
        this.step += 1;
      }
    };

    pump();
    this.timer = setInterval(pump, SCHEDULER_TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get running(): boolean {
    return this.timer !== null;
  }
}
