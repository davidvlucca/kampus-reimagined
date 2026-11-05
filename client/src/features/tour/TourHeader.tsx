import { X } from "lucide-react";
import type { RefObject } from "react";
import { IconButton, Logo } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { TourProgress } from "./TourProgress.tsx";
import type { TourMode } from "./useTourMode.ts";
import { TOTAL } from "./useTourNavigation.ts";

interface Props {
  headerRef: RefObject<HTMLElement | null>;
  index: number;
  stopName: string;
  onGo: (i: number) => void;
  /** Há WebGL: mostra a troca 2D/3D. */
  webgl: boolean;
  is3D: boolean;
  onMode: (mode: TourMode) => void;
  canSkip: boolean;
  busy: boolean;
  onSkip: () => void;
  onExit: () => void;
}

// Alvos de 44 px no telemóvel; no portátil (rato) ficam mais baixos.
const target = "h-11 lg:h-9 focus-on-dark";

/**
 * Topo: logótipo, contador, progresso, 2D/3D, saltar e sair. No portátil fica por cima do 3D: as
 * partes vazias (e o degradê) deixam passar o clique para as salas que estão por baixo.
 * No telemóvel o nome da paragem tem uma linha só dele, por baixo do progresso (ao lado do
 * contador ficava cortado: "Data An…").
 */
export function TourHeader({ headerRef, index, stopName, onGo, webgl, is3D, onMode, canSkip, busy, onSkip, onExit }: Props) {
  return (
    <header
      ref={headerRef}
      className={cn(
        "pointer-events-none relative z-20 flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-3 pb-2 *:pointer-events-auto",
        "sm:gap-x-3 big:[zoom:1.25] huge:[zoom:1.5]",
        // Por cima das ilustrações claras o texto precisa de um fundo bem escuro (contraste AA).
        "short:absolute short:inset-x-0 short:top-0 short:flex-nowrap short:pb-6",
        "short:bg-linear-to-b short:from-kampus-ink/95 short:via-kampus-ink/75 short:to-transparent",
        "lg:absolute lg:inset-x-0 lg:top-0 lg:flex-nowrap lg:gap-6 lg:px-10 lg:pt-5 lg:pb-12",
        "lg:bg-linear-to-b lg:from-kampus-ink/95 lg:via-kampus-ink/75 lg:to-transparent",
      )}
    >
      {/* Num ecrã de 320 px o logótipo sai: os controlos precisam do espaço numa fila só. */}
      <span className="max-[359px]:hidden lg:hidden">
        <Logo onDark showName={false} />
      </span>
      <span className="hidden lg:block">
        <Logo onDark />
      </span>
      <p className="shrink-0 font-display text-sm leading-none font-semibold tracking-widest whitespace-nowrap text-kampus-sky tabular-nums">
        STOP {index + 1}/{TOTAL}
      </p>
      <p
        className={cn(
          "order-last w-full text-sm font-medium text-white",
          "short:order-none short:w-auto short:min-w-0 short:shrink short:truncate lg:order-none lg:w-auto lg:shrink-0",
        )}
      >
        {stopName}
      </p>
      <TourProgress
        index={index}
        onGo={onGo}
        className={cn(
          "order-last w-full",
          "short:order-none short:w-auto short:min-w-28 short:flex-1 lg:order-none lg:w-auto lg:max-w-xl lg:flex-1",
        )}
      />
      {webgl && (
        <div role="group" aria-label="Tour view" className="ml-auto flex overflow-hidden rounded-xl ring-1 ring-white/30">
          {(["2d", "3d"] as const).map((mode) => {
            const pressed = (mode === "3d") === is3D;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={pressed}
                onClick={() => onMode(mode)}
                className={cn(
                  target,
                  "px-2.5 text-sm font-semibold transition-colors -outline-offset-2",
                  pressed ? "bg-white text-kampus-navy" : "text-white hover:bg-white/15",
                )}
              >
                {mode.toUpperCase()}
                <span className="sr-only"> tour</span>
              </button>
            );
          })}
        </div>
      )}
      {canSkip && (
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className={cn(target, "rounded-xl px-3 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-55", !webgl && "ml-auto")}
        >
          {/* No telemóvel só "Skip" à vista; o nome completo fica para leitores de ecrã. */}
          Skip<span className="max-sm:sr-only"> tour</span>
        </button>
      )}
      <IconButton
        label="Exit tour"
        icon={<X aria-hidden />}
        variant="onDark"
        onClick={onExit}
        className={cn("text-white", !canSkip && !webgl && "ml-auto")}
      />
    </header>
  );
}
