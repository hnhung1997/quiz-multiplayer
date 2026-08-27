import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LIMITS, DEFAULT_ANSWER_COLORS } from "@quiz/shared";
import {
  loadLocalQuestions,
  saveLocalQuestions,
  type LocalOption,
  type LocalQuestion,
} from "@/lib/local-questions";
import { cn } from "@/lib/utils";

function blankOptions(): LocalOption[] {
  return Array.from({ length: 4 }, (_, i) => ({
    text: "",
    color: DEFAULT_ANSWER_COLORS[i % DEFAULT_ANSWER_COLORS.length] as string,
  }));
}

interface Draft {
  q: string;
  opts: LocalOption[];
  a: number;
  explanation: string;
  time_limit: number;
}

function emptyDraft(): Draft {
  return { q: "", opts: blankOptions(), a: 0, explanation: "", time_limit: LIMITS.TIME_LIMIT_DEFAULT };
}

export function QuestionManagerPage() {
  const [questions, setQuestions] = useState<LocalQuestion[]>(() => loadLocalQuestions());
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function persist(next: LocalQuestion[]) {
    setQuestions(next);
    saveLocalQuestions(next);
  }

  function updateOption(index: number, patch: Partial<LocalOption>) {
    setDraft((d) => ({
      ...d,
      opts: d.opts.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  function addOption() {
    setDraft((d) =>
      d.opts.length >= LIMITS.OPTIONS_MAX
        ? d
        : {
            ...d,
            opts: [
              ...d.opts,
              {
                text: "",
                color: DEFAULT_ANSWER_COLORS[d.opts.length % DEFAULT_ANSWER_COLORS.length] as string,
              },
            ],
          }
    );
  }

  function removeOption(index: number) {
    setDraft((d) => {
      if (d.opts.length <= LIMITS.OPTIONS_MIN) return d;
      const opts = d.opts.filter((_, i) => i !== index);
      // Giữ đáp án đúng trỏ đúng chỗ sau khi xoá một dòng phía trên nó.
      const a = d.a === index ? 0 : d.a > index ? d.a - 1 : d.a;
      return { ...d, opts, a };
    });
  }

  function save() {
    const q = draft.q.trim();
    if (!q) return setError("Vui lòng nhập nội dung câu hỏi.");
    const opts = draft.opts.map((o) => ({ ...o, text: o.text.trim() }));
    if (opts.some((o) => !o.text)) return setError("Vui lòng nhập nội dung cho tất cả đáp án.");
    if (draft.a < 0 || draft.a >= opts.length) return setError("Vui lòng chọn đáp án đúng.");

    const record: LocalQuestion = {
      q,
      opts,
      a: draft.a,
      explanation: draft.explanation.trim(),
      img_correct: "dung.jpg",
      img_wrong: "sai.jpg",
      time_limit: draft.time_limit,
    };

    persist(
      editingIndex === null
        ? [...questions, record]
        : questions.map((item, i) => (i === editingIndex ? record : item))
    );
    setDraft(emptyDraft());
    setEditingIndex(null);
    setError(null);
  }

  function edit(index: number) {
    const q = questions[index];
    if (!q) return;
    setDraft({
      q: q.q,
      opts: q.opts.map((o) => ({ ...o })),
      a: q.a,
      explanation: q.explanation,
      time_limit: q.time_limit,
    });
    setEditingIndex(index);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(index: number) {
    persist(questions.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setDraft(emptyDraft());
      setEditingIndex(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Soạn câu hỏi</h1>
          <p className="mt-1 text-muted-foreground">
            Lưu trong trình duyệt này. Đăng nhập để đưa lên máy chủ và chơi nhóm.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/solo">Chơi thử</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingIndex === null ? "Câu hỏi mới" : `Sửa câu ${editingIndex + 1}`}</CardTitle>
          <CardDescription>Chọn nút tròn ở đáp án đúng, bấm ô màu để đổi màu nền.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="qtext">Nội dung câu hỏi</Label>
            <Textarea
              id="qtext"
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder="Nhập câu hỏi..."
              maxLength={LIMITS.QUESTION_TEXT_MAX}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Các đáp án</legend>
            {draft.opts.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md bg-secondary/50 p-2">
                <input
                  type="radio"
                  name="correct"
                  checked={draft.a === i}
                  onChange={() => setDraft((d) => ({ ...d, a: i }))}
                  className="size-4 accent-[var(--success)]"
                  aria-label={`Đáp án ${i + 1} là đáp án đúng`}
                />
                <input
                  type="color"
                  value={opt.color}
                  onChange={(e) => updateOption(i, { color: e.target.value })}
                  className="size-9 cursor-pointer rounded border border-border bg-transparent"
                  aria-label={`Màu đáp án ${i + 1}`}
                />
                <Input
                  value={opt.text}
                  onChange={(e) => updateOption(i, { text: e.target.value })}
                  placeholder={`Đáp án ${i + 1}`}
                  maxLength={LIMITS.OPTION_TEXT_MAX}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(i)}
                  disabled={draft.opts.length <= LIMITS.OPTIONS_MIN}
                  aria-label={`Bớt đáp án ${i + 1}`}
                >
                  <Minus className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addOption}
              disabled={draft.opts.length >= LIMITS.OPTIONS_MAX}
            >
              <Plus className="size-4" aria-hidden /> Thêm đáp án
            </Button>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="explanation">Giải thích (tuỳ chọn)</Label>
            <Textarea
              id="explanation"
              value={draft.explanation}
              onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
              placeholder="Hiện ra sau khi trả lời..."
              maxLength={LIMITS.EXPLANATION_MAX}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timelimit">
              Thời gian trả lời ({LIMITS.TIME_LIMIT_MIN}–{LIMITS.TIME_LIMIT_MAX} giây)
            </Label>
            <Input
              id="timelimit"
              type="number"
              min={LIMITS.TIME_LIMIT_MIN}
              max={LIMITS.TIME_LIMIT_MAX}
              value={draft.time_limit}
              onChange={(e) =>
                setDraft((d) => ({ ...d, time_limit: Number(e.target.value) || LIMITS.TIME_LIMIT_DEFAULT }))
              }
              className="w-32"
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={save} className="flex-1">
              <Check className="size-4" aria-hidden />
              {editingIndex === null ? "Lưu câu hỏi" : "Cập nhật"}
            </Button>
            {editingIndex !== null && (
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(emptyDraft());
                  setEditingIndex(null);
                  setError(null);
                }}
              >
                Huỷ sửa
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Đã lưu ({questions.length})</CardTitle>
          {questions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => persist([])}>
              <Trash2 className="size-4" aria-hidden /> Xoá tất cả
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có câu hỏi nào.</p>
          ) : (
            <ul className="space-y-2">
              {questions.map((q, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-md border border-border p-3",
                    editingIndex === i && "ring-2 ring-ring"
                  )}
                >
                  <span className="flex-1 truncate text-sm">
                    <span className="text-muted-foreground">{i + 1}.</span> {q.q}
                  </span>
                  <Badge variant="outline">{q.opts.length} đáp án</Badge>
                  <Button variant="ghost" size="icon" onClick={() => edit(i)} aria-label={`Sửa câu ${i + 1}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(i)}
                    aria-label={`Xoá câu ${i + 1}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
