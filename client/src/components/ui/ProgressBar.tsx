import { cn } from "../../lib/cn.ts";

export function ProgressBar({ value, max = 100, label, className, tone = "blue" }: { value: number; max?: number; label: string; className?: string; tone?: "blue" | "sky" }) {
  const pct = max > 0 ? Math.round((Math.min(value, max) / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={`${pct}%`}
      className={cn("h-2.5 w-full overflow-hidden rounded-full", tone === "blue" ? "bg-kampus-blue-soft" : "bg-white/20", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tone === "blue" ? "bg-kampus-gradient" : "bg-kampus-sky")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
