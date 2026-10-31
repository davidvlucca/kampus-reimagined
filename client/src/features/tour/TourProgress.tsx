import { TOUR_STOPS } from "@kampus/shared";
import { cn } from "../../lib/cn.ts";

/** Barra de progresso feita de botões, um por paragem. */
export function TourProgress({ index, onGo, className }: { index: number; onGo: (i: number) => void; className?: string }) {
  return (
    <nav aria-label="Tour stops" className={className}>
      <ol className="flex items-center gap-1">
        {TOUR_STOPS.map((stop, i) => (
          <li key={stop.id} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-label={`Go to stop ${i + 1}: ${stop.name}`}
              aria-current={i === index ? "step" : undefined}
              title={stop.name}
              className="group flex h-11 w-full items-center rounded-lg px-0.5 focus-on-dark"
            >
              <span
                aria-hidden
                className={cn(
                  "block h-1.5 w-full rounded-full transition-colors group-hover:bg-white",
                  i < index && "bg-kampus-sky",
                  i === index && "h-2.5 bg-white ring-2 ring-kampus-sky",
                  i > index && "bg-white/35",
                )}
              />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
