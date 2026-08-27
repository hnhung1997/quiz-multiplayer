/**
 * Trình soạn một câu hỏi, dùng chung cho ngân hàng trên máy chủ.
 * Ràng buộc lấy từ @quiz/shared nên khớp đúng với kiểm tra phía máy chủ.
 */
import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { DEFAULT_ANSWER_COLORS, LIMITS, type QuestionDto } from "@quiz/shared";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export interface QuestionDraft {
  text: string;
  explanation: string;
  timeLimit: number;
  options: Array<{ text: string; color: string; isCorrect: boolean }>;
}

export function emptyQuestionDraft(): QuestionDraft {
  return {
    text: "",
    explanation: "",
    timeLimit: LIMITS.TIME_LIMIT_DEFAULT,
    options: Array.from({ length: 4 }, (_, i) => ({
      text: "",
      color: DEFAULT_ANSWER_COLORS[i % DEFAULT_ANSWER_COLORS.length] as string,
      isCorrect: i === 0,
    })),
  };
}

export function draftFromQuestion(q: QuestionDto): QuestionDraft {
  return {
    text: q.text,
    explanation: q.explanation ?? "",
    timeLimit: q.timeLimit,
    options: q.options.map((o, i) => ({
      text: o.text,
      color: o.color ?? (DEFAULT_ANSWER_COLORS[i % DEFAULT_ANSWER_COLORS.length] as string),
      isCorrect: o.isCorrect === true,
    })),
  };
}

interface Props {
  value: QuestionDraft;
  onChange: (draft: QuestionDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel: string;
}

export function QuestionEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  function patchOption(index: number, patch: Partial<QuestionDraft["options"][number]>) {
    onChange({
      ...value,
      options: value.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    });
  }

  function markCorrect(index: number) {
    onChange({
      ...value,
      options: value.options.map((o, i) => ({ ...o, isCorrect: i === index })),
    });
  }

  function addOption() {
    if (value.options.length >= LIMITS.OPTIONS_MAX) return;
    onChange({
      ...value,
      options: [
        ...value.options,
        {
          text: "",
          color: DEFAULT_ANSWER_COLORS[value.options.length % DEFAULT_ANSWER_COLORS.length] as string,
          isCorrect: false,
        },
      ],
    });
  }

  function removeOption(index: number) {
    if (value.options.length <= LIMITS.OPTIONS_MIN) return;
    const options = value.options.filter((_, i) => i !== index);
    // Nếu vừa xoá mất đáp án đúng thì gán tạm cho ô đầu tiên.
    if (!options.some((o) => o.isCorrect) && options[0]) options[0].isCorrect = true;
    onChange({ ...value, options });
  }

  function submit() {
    if (!value.text.trim()) return setError("Vui lòng nhập nội dung câu hỏi.");
    if (value.options.some((o) => !o.text.trim()))
      return setError("Vui lòng nhập nội dung cho tất cả đáp án.");
    if (value.options.filter((o) => o.isCorrect).length !== 1)
      return setError("Cần chọn đúng một đáp án đúng.");
    setError(null);
    onSubmit();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="qtext">Nội dung câu hỏi</Label>
        <Textarea
          id="qtext"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          maxLength={LIMITS.QUESTION_TEXT_MAX}
          placeholder="Nhập câu hỏi..."
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Các đáp án</legend>
        {value.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md bg-secondary/50 p-2">
            <input
              type="radio"
              name="correct"
              checked={opt.isCorrect}
              onChange={() => markCorrect(i)}
              className="size-4 accent-[var(--success)]"
              aria-label={`Đáp án ${i + 1} là đáp án đúng`}
            />
            <input
              type="color"
              value={opt.color}
              onChange={(e) => patchOption(i, { color: e.target.value })}
              className="size-9 cursor-pointer rounded border border-border bg-transparent"
              aria-label={`Màu đáp án ${i + 1}`}
            />
            <Input
              value={opt.text}
              onChange={(e) => patchOption(i, { text: e.target.value })}
              placeholder={`Đáp án ${i + 1}`}
              maxLength={LIMITS.OPTION_TEXT_MAX}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeOption(i)}
              disabled={value.options.length <= LIMITS.OPTIONS_MIN}
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
          disabled={value.options.length >= LIMITS.OPTIONS_MAX}
        >
          <Plus className="size-4" aria-hidden /> Thêm đáp án
        </Button>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="explanation">Giải thích (tuỳ chọn)</Label>
        <Textarea
          id="explanation"
          value={value.explanation}
          onChange={(e) => onChange({ ...value, explanation: e.target.value })}
          maxLength={LIMITS.EXPLANATION_MAX}
          placeholder="Hiện ra sau khi trả lời..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="timelimit">
          Thời gian ({LIMITS.TIME_LIMIT_MIN}–{LIMITS.TIME_LIMIT_MAX} giây)
        </Label>
        <Input
          id="timelimit"
          type="number"
          min={LIMITS.TIME_LIMIT_MIN}
          max={LIMITS.TIME_LIMIT_MAX}
          value={value.timeLimit}
          onChange={(e) =>
            onChange({ ...value, timeLimit: Number(e.target.value) || LIMITS.TIME_LIMIT_DEFAULT })
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
        <Button onClick={submit} disabled={submitting} className="flex-1">
          {submitting ? <Spinner className="size-4" /> : <Check className="size-4" aria-hidden />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Huỷ
          </Button>
        )}
      </div>
    </div>
  );
}
