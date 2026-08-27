import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Save, Trash2 } from "lucide-react";
import type { BankSummaryDto, QuestionDto, QuizSummaryDto, Visibility } from "@quiz/shared";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";

interface QuizDetail {
  quiz: QuizSummaryDto;
  questions: QuestionDto[];
  canEdit: boolean;
}

export function QuizEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [isPublished, setIsPublished] = useState(false);
  const [allowTestMode, setAllowTestMode] = useState(true);
  const [selected, setSelected] = useState<QuestionDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const quizQuery = useQuery({
    queryKey: ["quiz", id],
    queryFn: () => api.get<QuizDetail>(`/api/quizzes/${id}`),
    enabled: !isNew,
  });

  const banksQuery = useQuery({
    queryKey: ["banks"],
    queryFn: () => api.get<{ banks: BankSummaryDto[] }>("/api/banks"),
  });

  const [openBankId, setOpenBankId] = useState<string | null>(null);
  const bankQuery = useQuery({
    queryKey: ["bank", openBankId],
    queryFn: () => api.get<{ questions: QuestionDto[] }>(`/api/banks/${openBankId}`),
    enabled: !!openBankId,
  });

  useEffect(() => {
    if (!quizQuery.data) return;
    const { quiz, questions } = quizQuery.data;
    setTitle(quiz.title);
    setDescription(quiz.description ?? "");
    setVisibility(quiz.visibility);
    setIsPublished(quiz.isPublished);
    setAllowTestMode(quiz.allowTestMode);
    setSelected(questions);
  }, [quizQuery.data]);

  const selectedIds = useMemo(() => new Set(selected.map((q) => q.id)), [selected]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        visibility,
        isPublished,
        allowTestMode,
      };

      const quizId = isNew
        ? (await api.post<{ quiz: QuizSummaryDto }>("/api/quizzes", body)).quiz.id
        : ((await api.patch<{ quiz: QuizSummaryDto }>(`/api/quizzes/${id}`, body)).quiz.id);

      if (selected.length > 0) {
        await api.put(`/api/quizzes/${quizId}/questions`, {
          questionIds: selected.map((q) => q.id),
        });
      }
      return quizId;
    },
    onSuccess: (quizId) => {
      void qc.invalidateQueries({ queryKey: ["quizzes"] });
      void qc.invalidateQueries({ queryKey: ["quiz", quizId] });
      navigate(`/quizzes/${quizId}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Không lưu được bộ quiz."),
  });

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    setSelected(next);
  }

  if (!isNew && quizQuery.isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">
        {isNew ? "Tạo bộ quiz" : "Sửa bộ quiz"}
      </h1>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin chung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tiêu đề</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Mô tả</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="vis">Công khai</Label>
              <p className="text-sm text-muted-foreground">
                Công khai thì mọi người đều thấy trong thư viện.
              </p>
            </div>
            <Switch
              id="vis"
              checked={visibility === "PUBLIC"}
              onCheckedChange={(v) => setVisibility(v ? "PUBLIC" : "PRIVATE")}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="pub">Đã xuất bản</Label>
              <p className="text-sm text-muted-foreground">Chưa xuất bản thì chỉ mình bạn thấy.</p>
            </div>
            <Switch id="pub" checked={isPublished} onCheckedChange={setIsPublished} />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="test">Cho phép làm bài kiểm tra</Label>
              <p className="text-sm text-muted-foreground">
                Hiện toàn bộ câu hỏi như tờ đề, nộp một lần.
              </p>
            </div>
            <Switch id="test" checked={allowTestMode} onCheckedChange={setAllowTestMode} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Câu hỏi đã chọn ({selected.length})</CardTitle>
          <CardDescription>Thứ tự ở đây chính là thứ tự khi chơi.</CardDescription>
        </CardHeader>
        <CardContent>
          {selected.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa chọn câu hỏi nào. Lấy từ ngân hàng bên dưới.
            </p>
          ) : (
            <ol className="space-y-2">
              {selected.map((q, i) => (
                <li key={q.id} className="flex items-center gap-2 rounded-md border border-border p-2.5">
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate text-sm">
                    <span className="text-muted-foreground">{i + 1}.</span> {q.text}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => move(i, 1)}
                    disabled={i === selected.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelected((s) => s.filter((x) => x.id !== q.id))}
                    aria-label={`Bỏ câu ${i + 1}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lấy câu hỏi từ ngân hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {banksQuery.data?.banks.map((b) => (
              <Button
                key={b.id}
                variant={openBankId === b.id ? "default" : "outline"}
                size="sm"
                onClick={() => setOpenBankId(openBankId === b.id ? null : b.id)}
              >
                {b.title} <Badge variant="secondary">{b.questionCount}</Badge>
              </Button>
            ))}
          </div>

          {openBankId && bankQuery.isLoading && <LoadingBlock label="Đang tải câu hỏi..." />}

          {openBankId && bankQuery.data && (
            <ul className="space-y-2">
              {bankQuery.data.questions.map((q) => {
                const picked = selectedIds.has(q.id);
                return (
                  <li key={q.id} className="flex items-center gap-2 rounded-md border border-border p-2.5">
                    <span className="flex-1 truncate text-sm">{q.text}</span>
                    <Button
                      size="sm"
                      variant={picked ? "secondary" : "default"}
                      onClick={() =>
                        setSelected((s) =>
                          picked ? s.filter((x) => x.id !== q.id) : [...s, q]
                        )
                      }
                    >
                      {picked ? "Bỏ chọn" : "Thêm"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={() => saveMutation.mutate()}
        disabled={!title.trim() || saveMutation.isPending}
      >
        {saveMutation.isPending ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
        Lưu bộ quiz
      </Button>
    </div>
  );
}
