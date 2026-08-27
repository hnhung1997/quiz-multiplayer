import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Globe, Lock, Plus } from "lucide-react";
import type { BankSummaryDto } from "@quiz/shared";
import { api, ApiError } from "@/lib/api";
import { loadLocalQuestions } from "@/lib/local-questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BanksPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState("Câu hỏi nhập từ trình duyệt");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const banksQuery = useQuery({
    queryKey: ["banks"],
    queryFn: () => api.get<{ banks: BankSummaryDto[] }>("/api/banks"),
  });

  // Câu hỏi còn sót trong localStorage của bản cũ — cho phép đẩy lên máy chủ.
  const [localCount] = useState(() => loadLocalQuestions().length);

  const createMutation = useMutation({
    mutationFn: (t: string) => api.post<{ bank: BankSummaryDto }>("/api/banks", { title: t }),
    onSuccess: () => {
      setTitle("");
      setCreating(false);
      void qc.invalidateQueries({ queryKey: ["banks"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Không tạo được ngân hàng."),
  });

  const importMutation = useMutation({
    mutationFn: () =>
      api.post<{ bankId: string; quizId: string | null; imported: number; skipped: number }>(
        "/api/banks/import",
        { bankTitle: importTitle, createQuiz: true, questions: loadLocalQuestions() }
      ),
    onSuccess: (res) => {
      setImportOpen(false);
      setMessage(
        `Đã nhập ${res.imported} câu hỏi${res.skipped > 0 ? ` (bỏ qua ${res.skipped} câu không hợp lệ)` : ""}.` +
          (res.quizId ? " Một bộ quiz nháp cũng đã được tạo." : "")
      );
      void qc.invalidateQueries({ queryKey: ["banks"] });
      void qc.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Không nhập được dữ liệu."),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Ngân hàng câu hỏi</h1>
          <p className="mt-1 text-muted-foreground">Soạn một lần, dùng cho nhiều bộ quiz.</p>
        </div>
        <div className="flex gap-2">
          {localCount > 0 && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="size-4" aria-hidden /> Nhập {localCount} câu từ trình duyệt
            </Button>
          )}
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Tạo ngân hàng
          </Button>
        </div>
      </div>

      {message && (
        <p className="rounded-md bg-success/10 p-3 text-sm text-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {banksQuery.isLoading ? (
        <LoadingBlock />
      ) : (banksQuery.data?.banks.length ?? 0) === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Chưa có ngân hàng câu hỏi nào.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banksQuery.data?.banks.map((b) => (
            <Card key={b.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{b.title}</CardTitle>
                  <Badge variant={b.visibility === "PUBLIC" ? "secondary" : "outline"}>
                    {b.visibility === "PUBLIC" ? (
                      <Globe className="size-3" aria-label="Công khai" />
                    ) : (
                      <Lock className="size-3" aria-label="Riêng tư" />
                    )}
                  </Badge>
                </div>
                <CardDescription>{b.questionCount} câu hỏi</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/banks/${b.id}`}>Mở</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ngân hàng câu hỏi mới</DialogTitle>
            <DialogDescription>Đặt tên để dễ tìm lại sau này.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bankTitle">Tên ngân hàng</Label>
            <Input
              id="bankTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Lịch sử lớp 7"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Huỷ
            </Button>
            <Button
              onClick={() => createMutation.mutate(title.trim())}
              disabled={!title.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Spinner className="size-4" />}
              Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập câu hỏi từ trình duyệt</DialogTitle>
            <DialogDescription>
              Tìm thấy {localCount} câu hỏi lưu trong trình duyệt này (từ chế độ chơi một mình).
              Nhập lên máy chủ để dùng cho chơi nhóm và kiểm tra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="importTitle">Tên ngân hàng mới</Label>
            <Input
              id="importTitle"
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
              {importMutation.isPending && <Spinner className="size-4" />}
              Nhập {localCount} câu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
