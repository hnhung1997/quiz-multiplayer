import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { loadLocalNames, saveLocalNames } from "@/lib/local-questions";
import { fireStarEffects, winnerConfetti } from "@/features/spinner/effects";

export function SpinnerPage() {
  const [names, setNames] = useState<string[]>(() => loadLocalNames());
  const [draft, setDraft] = useState("");
  const [display, setDisplay] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const spinBtnRef = useRef<HTMLButtonElement>(null);
  // Giữ mọi timer đang chạy để dọn sạch khi rời trang giữa chừng.
  const timers = useRef<Array<ReturnType<typeof setInterval>>>([]);

  useEffect(() => saveLocalNames(names), [names]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearInterval);
      timers.current = [];
    };
  }, []);

  function addName() {
    const value = draft.trim();
    if (!value) return;
    // Cho phép dán nhiều tên một lúc, mỗi dòng hoặc mỗi dấu phẩy là một tên.
    const incoming = value
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);
    setNames((prev) => [...prev, ...incoming]);
    setDraft("");
  }

  function removeName(index: number) {
    setNames((prev) => prev.filter((_, i) => i !== index));
  }

  function spin() {
    if (isSpinning || names.length === 0) return;
    setIsSpinning(true);
    setWinner(null);

    const stars = spinBtnRef.current
      ? setInterval(() => {
          if (spinBtnRef.current) fireStarEffects(spinBtnRef.current);
        }, 300)
      : null;
    if (stars) timers.current.push(stars);

    const total = 20 + Math.floor(Math.random() * 15);
    let i = 0;

    const cycle = setInterval(() => {
      setDisplay(names[i % names.length] ?? null);
      i++;
      if (i > total) {
        clearInterval(cycle);
        if (stars) clearInterval(stars);
        timers.current = timers.current.filter((t) => t !== cycle && t !== stars);

        const picked = names[(i - 1) % names.length] ?? null;
        setDisplay(picked);
        setIsSpinning(false);
        if (picked) {
          setTimeout(() => {
            setWinner(picked);
            winnerConfetti();
          }, 400);
        }
      }
    }, 100);
    timers.current.push(cycle);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Quay số may mắn</h1>
        <p className="mt-1 text-muted-foreground">Thêm tên rồi bấm quay để chọn ngẫu nhiên.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách tên</CardTitle>
          <CardDescription>
            {names.length === 0 ? "Chưa có tên nào." : `${names.length} tên trong danh sách.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addName();
              }}
              placeholder="Nhập tên, cách nhau bằng dấu phẩy..."
              aria-label="Tên mới"
            />
            <Button onClick={addName} disabled={!draft.trim()}>
              Thêm
            </Button>
          </div>

          {names.length > 0 && (
            <>
              <ul className="flex flex-wrap gap-2">
                {names.map((n, i) => (
                  <li
                    key={`${n}-${i}`}
                    className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium"
                  >
                    {n}
                    <button
                      onClick={() => removeName(i)}
                      className="rounded-full p-0.5 hover:bg-background"
                      aria-label={`Xoá ${n}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" size="sm" onClick={() => setNames([])}>
                <Trash2 className="size-4" aria-hidden /> Xoá tất cả
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="text-center">
        <CardContent className="space-y-6 pt-6">
          <div
            className="flex min-h-24 items-center justify-center font-display text-4xl font-bold"
            aria-live="polite"
          >
            {display ?? <span className="text-muted-foreground">— —</span>}
          </div>
          <Button
            ref={spinBtnRef}
            size="xl"
            className="w-full"
            onClick={spin}
            disabled={isSpinning || names.length === 0}
          >
            {isSpinning ? "Đang quay..." : "Quay số may mắn"}
          </Button>
          {names.length === 0 && (
            <p className="text-sm text-muted-foreground">Hãy thêm ít nhất một tên.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={winner !== null} onOpenChange={(open) => !open && setWinner(null)}>
        <DialogContent className="text-center">
          <DialogTitle className="font-display text-2xl">🎉 Chúc mừng 🎉</DialogTitle>
          <DialogDescription>Người may mắn là:</DialogDescription>
          <p className="font-display text-4xl font-bold text-primary">{winner}</p>
          <p aria-hidden className="text-2xl">⭐⭐⭐⭐⭐</p>
          <Button onClick={() => setWinner(null)}>Đóng</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
