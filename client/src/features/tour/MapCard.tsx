import { ChevronRight } from "lucide-react";
import { useId, type RefObject } from "react";
import { Button } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";

interface Props {
  cardRef: RefObject<HTMLElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Ainda não se entrou em nenhuma sala. */
  atStart: boolean;
  nextName: string;
  onContinue: () => void;
}

/** 3D, vista geral: escolher uma sala no mapa ou seguir a visita. */
export function MapCard({ cardRef, headingRef, atStart, nextName, onContinue }: Props) {
  const titleId = useId();
  return (
    <section
      ref={cardRef}
      aria-labelledby={titleId}
      className={cn(
        "pointer-events-auto relative rounded-[var(--radius-card)] bg-kampus-navy/95 p-5 shadow-pop ring-1 ring-white/15",
        "short:min-h-0 short:overflow-y-auto short:p-3.5 lg:mx-auto lg:max-w-xl lg:backdrop-blur",
      )}
    >
      <h2 id={titleId} ref={headingRef} tabIndex={-1} className="font-display text-lg font-semibold text-white outline-none short:text-base">
        Campus map
      </h2>
      <p className="mt-1 text-sm text-white/85">Choose a room on the map, or carry on with the tour.</p>
      <Button variant="light" onClick={onContinue} className="mt-4 w-full sm:w-auto short:mt-2">
        {atStart ? "Start at the Entrance" : `Continue to ${nextName}`}
        <ChevronRight aria-hidden className="size-4" />
      </Button>
    </section>
  );
}
