import { ChevronLeft, ChevronRight, Square, Volume2 } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";

interface Props {
  controlsRef: RefObject<HTMLDivElement | null>;
  nextRef: RefObject<HTMLButtonElement | null>;
  atFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  speechSupported: boolean;
  speaking: boolean;
  onToggleAudio: () => void;
  /** O aviso "Audio isn't supported" (quando o browser não tem voz). */
  audioHintId: string;
  completing: boolean;
  skipping: boolean;
}

const darkButton = "focus-on-dark ring-1 ring-white/25 grow lg:grow-0";

/** Controlos: fila fixa em baixo no telemóvel, dentro da caixa no desktop. */
export function TourControls({
  controlsRef,
  nextRef,
  atFirst,
  isLast,
  onBack,
  onNext,
  speechSupported,
  speaking,
  onToggleAudio,
  audioHintId,
  completing,
  skipping,
}: Props) {
  return (
    <div
      ref={controlsRef}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex flex-wrap gap-2 border-t border-white/10 bg-kampus-ink px-4 pt-3",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] short:flex-nowrap short:bg-kampus-ink/95 short:pt-2",
        "lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0",
      )}
    >
      <Button icon={<ChevronLeft aria-hidden className="size-4" />} onClick={onBack} disabled={atFirst} className={darkButton}>
        Back
      </Button>
      <Button
        icon={speaking ? <Square aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
        onClick={onToggleAudio}
        aria-disabled={!speechSupported || undefined}
        aria-describedby={speechSupported ? undefined : audioHintId}
        title={speechSupported ? undefined : "Audio isn't supported in this browser"}
        className={cn(darkButton, !speechSupported && "cursor-not-allowed opacity-55")}
      >
        {/* Num ecrã de 320 px só o ícone, para os botões caberem numa fila (o nome fica para leitores de ecrã) */}
        <span className="max-[359px]:sr-only">{speaking ? "Stop audio" : "Play audio"}</span>
      </Button>
      <Button
        ref={nextRef}
        variant="light"
        onClick={onNext}
        loading={isLast && completing}
        disabled={skipping}
        className="grow lg:ml-auto lg:grow-0"
      >
        {isLast ? "Go to my dashboard" : "Next"}
        {!isLast && <ChevronRight aria-hidden className="size-4" />}
      </Button>
    </div>
  );
}
