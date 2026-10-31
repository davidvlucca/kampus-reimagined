import { useId } from "react";
import { cn } from "../../lib/cn.ts";

/** O hexágono "K" do original, redesenhado em SVG, com o nome ao lado. */
export function Logo({ className, onDark = false, showName = true }: { className?: string; onDark?: boolean; showName?: boolean }) {
  // Um id por instância: com dois logótipos na página (sidebar escondida + topo), um id fixo apontava para o escondido.
  const gradientId = useId();
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" aria-hidden className="size-9 shrink-0">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={onDark ? "#A6E1FA" : "#0E6BA8"} />
            <stop offset="1" stopColor={onDark ? "#ffffff" : "#0A2472"} />
          </linearGradient>
        </defs>
        <path d="M32 3l25 14.5v29L32 61 7 46.5v-29z" fill={`url(#${gradientId})`} />
        <path d="M24 18h7v11l10-11h9L38.5 30.5 51 46h-9l-8.5-11L31 37.6V46h-7z" fill={onDark ? "#0A2472" : "#fff"} />
      </svg>
      {showName && (
        <span className={cn("font-display text-xl font-semibold tracking-tight", onDark ? "text-white" : "text-kampus-navy")}>Kampus</span>
      )}
    </span>
  );
}
