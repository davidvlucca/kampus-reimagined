import { CAMPUS_NAME, GUIDES, TOUR_STOPS } from "@kampus/shared";
import { ChevronLeft, ChevronRight, Square, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useCompleteTour, useContacts, useCurrentUser, useSkipTour } from "../../api/hooks.ts";
import { Button, IconButton, Logo, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName } from "../../lib/format.ts";
import { sceneSrcSet, SCENE_SIZES } from "./scene.ts";
import { SceneImage } from "./SceneImage.tsx";
import { TourProgress } from "./TourProgress.tsx";
import { useReducedMotion } from "./useReducedMotion.ts";
import { useSpeech } from "./useSpeech.ts";
import { useTypewriter } from "./useTypewriter.ts";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";

const TOTAL = TOUR_STOPS.length;

// Elementos onde Enter/espaço já fazem alguma coisa: aí não mexemos.
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("button, a, input, textarea, select, [role='button']") !== null;
}

export function TourPage() {
  useDocumentTitle("Virtual tour");
  const user = useCurrentUser();
  const contacts = useContacts();
  const completeTour = useCompleteTour();
  const skipTour = useSkipTour();
  const toast = useToast();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const speech = useSpeech();
  const audioHintId = useId();

  // `prev` fica por baixo enquanto o cenário novo aparece (fade).
  const [{ index, prev }, setScenes] = useState<{ index: number; prev: number | null }>({ index: 0, prev: null });
  const stop = TOUR_STOPS[index]!;
  const guide = GUIDES[stop.guide];
  const isLast = index === TOTAL - 1;
  const { shown, done, finish } = useTypewriter(stop.text, index, reducedMotion);

  // Nome do guia a partir dos contactos; enquanto carrega ou se falhar, só o cargo.
  const guideContact = contacts.data?.find((c) => c.title === guide.title);
  const guideLabel = guideContact ? `${fullName(guideContact)} · ${guide.title}` : guide.title;

  const canSkip = !user.tourCompletedAt && !user.tourSkippedAt;
  const busy = completeTour.isPending || skipTour.isPending;

  const { stop: stopSpeech } = speech;
  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(TOTAL - 1, next));
      if (target === index) return;
      stopSpeech();
      setScenes({ index: target, prev: index });
    },
    [index, stopSpeech],
  );

  const exit = useCallback(() => navigate("/app"), [navigate]);

  const complete = useCallback(() => {
    if (completeTour.isPending) return;
    completeTour.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Tour complete — welcome to campus!", tone: "success" });
        navigate("/app");
      },
      onError: (error) => toast({ title: "Couldn't finish the tour", description: errorMessage(error), tone: "error" }),
    });
  }, [completeTour, toast, navigate]);

  function skip() {
    skipTour.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "You can take the tour anytime from the menu." });
        navigate("/app");
      },
      onError: (error) => toast({ title: "Couldn't skip the tour", description: errorMessage(error), tone: "error" }),
    });
  }

  const next = useCallback(() => (isLast ? complete() : goTo(index + 1)), [isLast, complete, goTo, index]);

  // Teclado: ← → mudam de paragem, Enter mostra o texto todo ou avança, Esc sai.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        exit();
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === "Enter" && !isInteractive(event.target)) {
        event.preventDefault();
        if (done) next();
        else finish();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, exit, finish, goTo, index, next]);

  // Pré-carrega o cenário da paragem seguinte.
  useEffect(() => {
    const upcoming = TOUR_STOPS[index + 1];
    if (!upcoming) return;
    const img = new Image();
    img.sizes = SCENE_SIZES;
    img.srcset = sceneSrcSet(upcoming.scene);
    img.src = upcoming.scene;
  }, [index]);

  function toggleAudio() {
    if (!speech.supported) return;
    if (speech.speaking) speech.stop();
    else speech.speak(stop.text);
  }

  const prevStop = prev !== null ? TOUR_STOPS[prev] : undefined;
  const darkButton = "focus-on-dark ring-1 ring-white/25 grow lg:grow-0";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-kampus-ink text-white lg:h-dvh lg:overflow-hidden">
      <h1 className="sr-only">Virtual tour of {CAMPUS_NAME}</h1>

      {/* Topo: logótipo, contador, progresso, saltar e sair */}
      <header className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 pb-1 lg:absolute lg:inset-x-0 lg:top-0 lg:flex-nowrap lg:gap-6 lg:bg-linear-to-b lg:from-kampus-ink/85 lg:via-kampus-ink/50 lg:to-transparent lg:px-10 lg:pt-5 lg:pb-12">
        <span className="lg:hidden">
          <Logo onDark showName={false} />
        </span>
        <span className="hidden lg:block">
          <Logo onDark />
        </span>
        <p className="flex min-w-0 flex-1 items-baseline gap-2 lg:flex-none">
          <span className="font-pixel text-2xl leading-none tracking-wide whitespace-nowrap text-kampus-sky">
            STOP {index + 1}/{TOTAL}
          </span>
          <span className="truncate text-sm font-medium text-white/90">{stop.name}</span>
        </p>
        <TourProgress index={index} onGo={goTo} className="order-last w-full lg:order-none lg:w-auto lg:max-w-xl lg:flex-1" />
        {canSkip && (
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className="rounded-md px-1 text-sm text-white/85 underline underline-offset-4 hover:text-white focus-on-dark disabled:opacity-55 lg:ml-auto"
          >
            Skip tour
          </button>
        )}
        <IconButton label="Exit tour" icon={<X aria-hidden />} variant="onDark" onClick={exit} className={cn(!canSkip && "lg:ml-auto")} />
      </header>

      {/* Cenário */}
      <div className="relative h-[45dvh] shrink-0 overflow-hidden bg-kampus-ink lg:absolute lg:inset-0 lg:h-auto">
        {prevStop && (
          <div aria-hidden>
            <SceneImage key={`prev-${prev}`} scene={prevStop.scene} alt="" fade={false} />
          </div>
        )}
        <SceneImage key={index} scene={stop.scene} alt={stop.sceneAlt} />
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-linear-to-t from-kampus-ink/70 via-transparent to-transparent lg:block" />
      </div>

      {/* Guia e caixa de diálogo */}
      <main className="relative z-10 flex flex-1 flex-col px-4 pt-4 pb-40 lg:absolute lg:inset-x-0 lg:bottom-0 lg:px-10 lg:pt-0 lg:pb-8">
        <div className="relative mx-auto w-full max-w-6xl">
          <img
            src={guide.image}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-8 left-0 hidden h-[min(58dvh,520px)] w-auto lg:block"
          />
          <section
            aria-label="Guide"
            className="relative rounded-[var(--radius-card)] bg-kampus-navy/95 p-5 shadow-pop ring-1 ring-white/15 lg:ml-72 lg:backdrop-blur lg:p-7"
          >
            <div className="flex items-center gap-3">
              <img
                src={guide.image}
                alt=""
                aria-hidden
                className="size-14 shrink-0 rounded-full bg-kampus-sky-soft object-cover object-top ring-2 ring-kampus-sky lg:hidden"
              />
              <p className="rounded-lg bg-kampus-sky px-3 py-1 text-sm font-semibold text-kampus-ink">{guideLabel}</p>
            </div>

            {/* Clicar no texto mostra-o todo (no teclado: Enter) */}
            <div onClick={finish} className={cn("mt-4 grid text-base leading-relaxed lg:text-lg", !done && "cursor-pointer")}>
              {/* A versão invisível reserva o espaço do texto completo para nada saltar */}
              <p aria-hidden className="invisible [grid-area:1/1]">
                {stop.text}
              </p>
              <p aria-hidden className="[grid-area:1/1]">
                {shown}
              </p>
            </div>
            <p aria-live="polite" className="sr-only">
              Stop {index + 1} of {TOTAL}: {stop.name}. {stop.text}
            </p>
            <p aria-hidden className={cn("mt-2 hidden text-xs text-white/75 lg:block", done && "invisible")}>
              Press Enter or click the text to show it all
            </p>

            {!speech.supported && (
              <p id={audioHintId} className="mt-2 text-xs text-white/75">
                Audio isn't supported in this browser
              </p>
            )}

            {/* Controlos: fila fixa em baixo no telemóvel, dentro da caixa no desktop */}
            <div className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap gap-2 border-t border-white/10 bg-kampus-ink px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
              <Button
                icon={<ChevronLeft aria-hidden className="size-4" />}
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className={darkButton}
              >
                Back
              </Button>
              <Button
                icon={speech.speaking ? <Square aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
                onClick={toggleAudio}
                aria-disabled={!speech.supported || undefined}
                aria-describedby={speech.supported ? undefined : audioHintId}
                title={speech.supported ? undefined : "Audio isn't supported in this browser"}
                className={cn(darkButton, !speech.supported && "cursor-not-allowed opacity-55")}
              >
                {speech.speaking ? "Stop audio" : "Play audio"}
              </Button>
              <Button
                variant="light"
                onClick={next}
                loading={isLast && completeTour.isPending}
                disabled={skipTour.isPending}
                className="grow lg:ml-auto lg:grow-0"
              >
                {isLast ? "Go to my dashboard" : "Next"}
                {!isLast && <ChevronRight aria-hidden className="size-4" />}
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
