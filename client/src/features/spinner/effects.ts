/**
 * Hiệu ứng ăn mừng, chuyển từ js.html bản cũ.
 * Tôn trọng cài đặt "giảm chuyển động" của hệ điều hành.
 */
import confetti from "canvas-confetti";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Pháo giấy nhẹ khi mở trang chào. */
export function welcomeConfetti(durationMs = 2000): void {
  if (prefersReducedMotion()) return;
  const end = Date.now() + durationMs;

  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#ff0000", "#ffd700"] });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#0000ff", "#00ff00"] });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Pháo giấy lớn khi quay trúng tên. */
export function winnerConfetti(): void {
  if (prefersReducedMotion()) return;
  const count = 200;
  const defaults = { origin: { y: 0.7 }, zIndex: 10001 };
  const fire = (ratio: number, opts: confetti.Options) =>
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * ratio) });

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}

/** Sao bay từ mép màn hình về phía nút đang quay. */
export function fireStarEffects(target: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};

  const rect = target.getBoundingClientRect();
  const tx = rect.left + rect.width / 2;
  const ty = rect.top + rect.height / 2;
  const created: HTMLElement[] = [];

  for (let i = 0; i < 20; i++) {
    let sx: number;
    let sy: number;
    if (Math.random() < 0.5) {
      sx = Math.random() < 0.5 ? -50 : window.innerWidth + 50;
      sy = Math.random() * window.innerHeight;
    } else {
      sx = Math.random() * window.innerWidth;
      sy = Math.random() < 0.5 ? -50 : window.innerHeight + 50;
    }

    const ex = tx + (Math.random() - 0.5) * 50;
    const ey = ty + (Math.random() - 0.5) * 50;

    const star = document.createElement("div");
    star.textContent = ["⭐", "🌟", "✨", "⚡"][Math.floor(Math.random() * 4)] as string;
    star.style.cssText = `position:fixed;left:${sx}px;top:${sy}px;font-size:24px;pointer-events:none;z-index:10000;`;
    star.animate(
      [
        { transform: "translate(0,0) scale(0.4)", opacity: 0 },
        { transform: `translate(${ex - sx}px, ${ey - sy}px) scale(1.3)`, opacity: 1 },
      ],
      { duration: 800, easing: "cubic-bezier(.2,.8,.2,1)" }
    ).onfinish = () => star.remove();

    document.body.appendChild(star);
    created.push(star);
  }

  return () => created.forEach((s) => s.remove());
}
