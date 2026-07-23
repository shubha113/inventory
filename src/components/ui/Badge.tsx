import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "ok" | "warn" | "danger" | "neutral" | "brand";

const toneClasses: Record<Tone, string> = {
  ok: "bg-ok-50 text-ok-600",
  warn: "bg-warn-50 text-warn-600",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-700",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}
