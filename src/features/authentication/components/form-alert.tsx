import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function FormAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        tone === "error" ? "border-danger/30 bg-danger/8 text-danger" : "border-success/30 bg-success/8 text-success",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="text-fg">{children}</div>
    </div>
  );
}
