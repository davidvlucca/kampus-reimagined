import { cn } from "../../lib/cn.ts";

export function ProgressBar({ value, max = 100, label, className, tone = "blue" }: { value: number; max?: number; label: string; className?: string; tone?: "blue" | "sky" }) {
  // Sem total (ex.: turma sem alunos) a barra fica vazia, com um máximo válido para o ARIA.
  const safeMax = Math.max(max, 1);
  const pct = max > 0 ? Math.round((Math.min(value, max) / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(value, safeMax)}
      aria-valuetext={`${pct}%`}
      className={cn("h-2.5 w-full overflow-hidden rounded-full forced-colors:border forced-colors:border-[CanvasText]", tone === "blue" ? "bg-kampus-blue-soft" : "bg-white/20", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 forced-colors:bg-[Highlight] forced-colors:forced-color-adjust-none", tone === "blue" ? "bg-kampus-gradient" : "bg-kampus-sky")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
