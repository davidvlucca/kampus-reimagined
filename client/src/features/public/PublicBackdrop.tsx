import { cn } from "../../lib/cn.ts";

// A planta da visita 3D (grelha 3×2) e a volta pelas salas: Entrance → Web Dev → UX/UI → Data → Kitchen → Lounge.
const WALLS = [
  // Paredes interiores, com uma porta (falha) a meio de cada uma.
  "M200 0V80M200 120V280M200 320V400",
  "M400 0V80M400 120V280M400 320V400",
  "M0 200H80M120 200H280M320 200H480M520 200H600",
];
const ROUTE = "M100 300V100H500V300H300H100";
const STOPS = [
  [100, 300],
  [100, 100],
  [300, 100],
  [500, 100],
  [500, 300],
  [300, 300],
] as const;

/** Fundo das páginas públicas: luz suave e a planta do campus em linhas finas (só decoração, estático). */
export function PublicBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute -top-32 -left-32 size-[28rem] rounded-full bg-kampus-sky/10 blur-3xl" />
      <div className="absolute -right-40 -bottom-40 size-[32rem] rounded-full bg-kampus-ink/40 blur-3xl" />
      <svg
        viewBox="-4 -4 608 408"
        className="absolute top-20 -right-24 w-[min(20rem,75vw)] rotate-[-6deg] text-white opacity-[0.12] sm:top-24 sm:right-[3%]"
        fill="none"
        stroke="currentColor"
      >
        <rect x="0" y="0" width="600" height="400" rx="12" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {WALLS.map((d) => (
          <path key={d} d={d} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={ROUTE} strokeWidth="1.5" strokeDasharray="4 8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {STOPS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" fill="currentColor" stroke="none" />
        ))}
      </svg>
    </div>
  );
}
