import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export type BadgeTone = "neutral" | "blue" | "sky" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface text-muted border-line",
  blue: "bg-kampus-blue-soft text-kampus-blue border-kampus-blue/20",
  sky: "bg-kampus-sky-soft text-kampus-navy border-kampus-sky",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
};

// Sem whitespace-nowrap: com o texto a 200% num ecrã estreito o rótulo parte em vez de sair do ecrã.
export function Badge({ tone = "neutral", icon, children, className }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 max-w-full rounded-full border wrap-break-word px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
