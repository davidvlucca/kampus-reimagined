import { X } from "lucide-react";
import type { RefObject } from "react";
import { IconButton, Logo } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { TourProgress } from "./TourProgress.tsx";
import { TOTAL } from "./useTourNavigation.ts";

interface Props {
  headerRef: RefObject<HTMLElement | null>;
  index: number;
  stopName: string;
  onGo: (i: number) => void;
  /** Há WebGL: mostra a troca 2D/3D. */
  webgl: boolean;
  is3D: boolean;
  onSwitchMode: () => void;
  canSkip: boolean;
  busy: boolean;
  onSkip: () => void;
  onExit: () => void;
}

const linkButton = "rounded-md px-1 text-sm text-white/85 underline underline-offset-4 hover:text-white focus-on-dark";

/**
 * Topo: logótipo, contador, progresso, saltar e sair. No portátil fica por cima do 3D: as partes
 * vazias (e o degradê) deixam passar o clique para as salas que estão por baixo.
 */
export function TourHeader({ headerRef, index, stopName, onGo, webgl, is3D, onSwitchMode, canSkip, busy, onSkip, onExit }: Props) {
  return (
    <header
      ref={headerRef}
      className={cn(
        "pointer-events-none relative z-20 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 pb-1 *:pointer-events-auto",
        "max-[359px]:gap-x-2 big:[zoom:1.25] huge:[zoom:1.5]",
        "short:absolute short:inset-x-0 short:top-0 short:flex-nowrap short:bg-linear-to-b short:from-kampus-ink/90 short:to-transparent short:pb-6",
        "lg:absolute lg:inset-x-0 lg:top-0 lg:flex-nowrap lg:gap-6 lg:px-10 lg:pt-5 lg:pb-12",
        "lg:bg-linear-to-b lg:from-kampus-ink/85 lg:via-kampus-ink/50 lg:to-transparent",
      )}
    >
      <span className="lg:hidden">
        <Logo onDark showName={false} />
      </span>
      <span className="hidden lg:block">
        <Logo onDark />
      </span>
      <p className="flex min-w-0 flex-1 items-baseline gap-2 lg:flex-none">
        <span className="shrink-0 font-pixel text-2xl leading-none tracking-wide whitespace-nowrap text-kampus-sky max-[359px]:text-xl">
          STOP {index + 1}/{TOTAL}
        </span>
        <span className="truncate text-sm font-medium text-white/90">{stopName}</span>
      </p>
      <TourProgress
        index={index}
        onGo={onGo}
        className="order-last w-full short:order-none short:w-auto short:flex-1 lg:order-none lg:w-auto lg:max-w-xl lg:flex-1"
      />
      {webgl && (
        <button type="button" onClick={onSwitchMode} className={cn(linkButton, "lg:ml-auto")}>
          {/* No telemóvel só "2D"/"3D" à vista; o nome completo fica para leitores de ecrã. */}
          <span className="sr-only lg:not-sr-only">Switch to </span>
          {is3D ? "2D" : "3D"}
          <span className="sr-only"> tour</span>
        </button>
      )}
      {canSkip && (
        <button type="button" onClick={onSkip} disabled={busy} className={cn(linkButton, "disabled:opacity-55", !webgl && "lg:ml-auto")}>
          Skip tour
        </button>
      )}
      <IconButton label="Exit tour" icon={<X aria-hidden />} variant="onDark" onClick={onExit} className={cn(!canSkip && !webgl && "lg:ml-auto")} />
    </header>
  );
}
