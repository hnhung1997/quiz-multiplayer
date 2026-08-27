import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import type { BankSummaryDto, QuestionDto } from "@quiz/shared";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";
import {
  QuestionEditor,
  draftFromQuestion,
  emptyQuestionDraft,
  type QuestionDraft,
} from "@/components/question-editor";
import { answerTileStyle } from "@/lib/color";

interface BankResponse {
  bank: BankSummaryDto;
  questions: QuestionDto[];
}

export function BankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<QuestionDraft>(emptyQuestionDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bankQuery = useQuery({
    queryKey: ["bank", id],
    queryFn: () => api.get<BankResponse>(`/api/banks/${id}`),
    enabled: !!id,
  });

  const payload = (d: QuestionDraft) => ({
    text: d.text.trim(),
    explanation: d.explanation.trim() || null,
    timeLimit: d.timeLimit,
    options: d.options.map((o) => ({ text: o.text.trim(), color: o.color, isCorrect: o.isCorrect })),
  });

  const reset = () => {
    setDraft(emptyQuestionDraft());
    setEditingId(null);
  };

  const saveMutation = useMutation({
    mutationFn: (d: QuestionDraft) =>
      editingId
        ? api.patch<{ question: QuestionDto }>(`/api/questions/${editingId}`, payload(d))
        : api.post<{ question: QuestionDto }>(`/api/banks/${id}/questions`, payload(d)),
    onSuccess: () => {
      reset();
      setError(null);
      void qc.invalidateQueries({ queryKey: ["bank", id] });
      void qc.invalidateQueries({ queryKey: ["banks"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Không lưu được câu hỏi."),
  });

  const deleteMutation = useMutation({
    mutationFn: (qid: string) => api.delete(`/api/questions/${qid}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank", id] });
      void qc.invalidateQueries({ queryKey: ["banks"] });
    },
  });

  if (bankQuery.isLoading) return <LoadingBlock />;
  if (bankQuery.isError) {
    return <p className="py-16 text-center text-destructive">Không mở được ngân hàng câu hỏi.</p>;
  }
  if (!bankQuery.data) return null;

  const { bank, questions } = bankQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{bank.title}</h1>
        <p className="mt-1 text-muted-foreground">
          {bank.description || "Không có mô tả."} — {questions.length} câu hỏi
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Sửa câu hỏi" : "Câu hỏi mới"}</CardTitle>
          <CardDescription>Chọn nút tròn ở đáp án đúng.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <QuestionEditor
            value={draft}
            onChange={setDraft}
            onSubmit={() => saveMutation.mutate(draft)}
            onCancel={editingId ? reset : undefined}
            submitting={saveMutation.isPending}
            submitLabel={editingId ? "Cập nhật" : "Thêm câu hỏi"}
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {questions.map((q, qi) => (
          <Card key={q.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
              <CardTitle className="text-base">
                <span className="text-muted-foreground">Câu {qi + 1}.</span> {q.text}
              </CardTitle>
              <div className="flex shrink-0 gap-1">
                <Badge variant="outline">{q.timeLimit}s</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDraft(draftFromQuestion(q));
                    setEditingId(q.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  aria-label={`Sửa câu ${qi + 1}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(q.id)}
                  aria-label={`Xoá câu ${qi + 1}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => (
                <div
                  key={o.id}
                  style={answerTileStyle(o.color, oi)}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold"
                >
                  <span>{o.text}</span>
                  {o.isCorrect === true && <span aria-label="Đáp án đúng">✅</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
