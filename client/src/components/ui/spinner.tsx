import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin", className)} aria-hidden />;
}

export function LoadingBlock({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
