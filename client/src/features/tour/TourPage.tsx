import { CAMPUS_NAME, GUIDES, guideImage, TOUR_STOPS } from "@kampus/shared";
import { Check, ChevronLeft, ChevronRight, Square, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useCompleteTour, useContacts, useCurrentUser, useSkipTour } from "../../api/hooks.ts";
import { Button, IconButton, Logo, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName } from "../../lib/format.ts";
import { GuidePortrait } from "./GuidePortrait.tsx";
import { preloadScene } from "./scene.ts";
import { SceneImage } from "./SceneImage.tsx";
import { TourProgress } from "./TourProgress.tsx";
import { useReducedMotion } from "./useReducedMotion.ts";
import { useSpeech } from "./useSpeech.ts";
import { useTypewriter } from "./useTypewriter.ts";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";
import { useMouthFlap } from "./useMouthFlap.ts";

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
  const askId = useId();

  // `prev` fica por baixo enquanto o cenário novo aparece (fade).
  const [{ index, prev }, setScenes] = useState<{ index: number; prev: number | null }>({ index: 0, prev: null });
  const stop = TOUR_STOPS[index]!;
  const guide = GUIDES[stop.guide];
  const isLast = index === TOTAL - 1;

  // A pergunta feita nesta paragem (a fala passa a ser a resposta) e as já feitas na visita.
  const [question, setQuestion] = useState<string | null>(null);
  const [asked, setAsked] = useState<ReadonlySet<string>>(() => new Set());
  const answer = question ? stop.questions.find((q) => q.id === question) : undefined;
  const line = answer?.answer ?? stop.text;
  const mood = answer?.mood ?? stop.mood;

  const { shown, done, finish } = useTypewriter(line, `${index}:${question ?? ""}`, reducedMotion);
  const mouthOpen = useMouthFlap(!done && !reducedMotion);
  // As perguntas aparecem quando a fala da paragem acaba e ficam visíveis daí em diante
  // (esconder o botão que tem o foco fazia o teclado perder o sítio).
  const showQuestions = done || question !== null || stop.questions.some((q) => asked.has(q.id));

  // Nome do guia a partir dos contactos; enquanto carrega ou se falhar, só o cargo.
  const guideContact = contacts.data?.find((c) => c.title === guide.title);
  const guideLabel = guideContact ? `${fullName(guideContact)} · ${guide.title}` : guide.title;
  const guideName = guideContact?.firstName ?? `the ${guide.title}`;

  const canSkip = !user.tourCompletedAt && !user.tourSkippedAt;
  const busy = completeTour.isPending || skipTour.isPending;

  const { stop: stopSpeech } = speech;
  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(TOTAL - 1, next));
      if (target === index) return;
      stopSpeech();
      setQuestion(null);
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

  /** Faz uma pergunta; a mesma outra vez volta à fala da paragem. */
  const ask = useCallback(
    (id: string) => {
      stopSpeech();
      setQuestion((current) => (current === id ? null : id));
      setAsked((prevAsked) => new Set(prevAsked).add(id));
    },
    [stopSpeech],
  );

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
      } else if (event.key === "Enter" && !event.repeat && !isInteractive(event.target)) {
        // Sem repetição: manter o Enter carregado saltava paragens.
        event.preventDefault();
        if (done) next();
        else finish();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, exit, finish, goTo, index, next]);

  // Pré-carrega o cenário e as caras do guia da paragem seguinte.
  useEffect(() => {
    const upcoming = TOUR_STOPS[index + 1];
    if (!upcoming) return;
    preloadScene(upcoming.scene);
    for (const face of ["smile", "wink", "curious", "talk"] as const) preloadScene(guideImage(upcoming.guide, face));
  }, [index]);

  function toggleAudio() {
    if (!speech.supported) return;
    if (speech.speaking) speech.stop();
    else speech.speak(line);
  }

  const prevStop = prev !== null ? TOUR_STOPS[prev] : undefined;
  const darkButton = "focus-on-dark ring-1 ring-white/25 grow lg:grow-0";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-kampus-ink text-white short:h-dvh short:overflow-hidden lg:h-dvh lg:overflow-hidden">
      <h1 className="sr-only">Virtual tour of {CAMPUS_NAME}</h1>

      {/* Topo: logótipo, contador, progresso, saltar e sair */}
      <header className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 pb-1 short:absolute short:inset-x-0 short:top-0 short:flex-nowrap short:bg-linear-to-b short:from-kampus-ink/90 short:to-transparent short:pb-6 lg:absolute lg:inset-x-0 lg:top-0 lg:flex-nowrap lg:gap-6 lg:bg-linear-to-b lg:from-kampus-ink/85 lg:via-kampus-ink/50 lg:to-transparent lg:px-10 lg:pt-5 lg:pb-12">
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
        <TourProgress index={index} onGo={goTo} className="order-last w-full short:order-none short:w-auto short:flex-1 lg:order-none lg:w-auto lg:max-w-xl lg:flex-1" />
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
      <div className="relative h-[45dvh] shrink-0 overflow-hidden bg-kampus-ink short:absolute short:inset-0 short:h-auto lg:absolute lg:inset-0 lg:h-auto">
        {prevStop && (
          <div aria-hidden>
            <SceneImage key={`prev-${prev}`} scene={prevStop.scene} alt="" fade={false} />
          </div>
        )}
        <SceneImage key={index} scene={stop.scene} alt={stop.sceneAlt} />
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-linear-to-t from-kampus-ink/70 via-transparent to-transparent short:block lg:block" />
      </div>

      {/* Guia e caixa de diálogo */}
      <main className="relative z-10 flex flex-1 flex-col px-4 pt-4 pb-40 short:absolute short:inset-x-0 short:bottom-0 short:flex-none short:pt-0 short:pb-[4.75rem] lg:absolute lg:inset-x-0 lg:bottom-0 lg:px-10 lg:pt-0 lg:pb-8">
        <div className="relative mx-auto w-full max-w-6xl">
          <GuidePortrait
            guide={stop.guide}
            face={mouthOpen ? "talk" : mood}
            className="absolute -bottom-8 left-0 hidden h-[min(58dvh,520px)] lg:grid"
            imgClassName="h-full w-auto"
          />
          <section
            aria-label="Guide"
            className="relative rounded-[var(--radius-card)] bg-kampus-navy/95 p-5 shadow-pop ring-1 ring-white/15 short:p-3.5 lg:ml-72 lg:backdrop-blur lg:p-7"
          >
            <div className="flex items-center gap-3">
              <GuidePortrait
                guide={stop.guide}
                face={mouthOpen ? "talk" : mood}
                className="size-14 shrink-0 overflow-hidden rounded-full bg-kampus-sky-soft ring-2 ring-kampus-sky short:size-9 lg:hidden"
                imgClassName="size-full object-cover object-top"
              />
              <p className="rounded-lg bg-kampus-sky px-3 py-1 text-sm font-semibold text-kampus-ink">{guideLabel}</p>
            </div>

            {/* Clicar no texto mostra-o todo (no teclado: Enter) */}
            <div onClick={finish} className={cn("mt-4 grid text-base leading-relaxed short:mt-2 short:text-sm lg:text-lg", !done && "cursor-pointer")}>
              {/* As versões invisíveis reservam o espaço da fala mais longa da paragem (com as
                  respostas), para a caixa não mudar de altura ao fazer uma pergunta */}
              {[stop.text, ...stop.questions.map((q) => q.answer)].map((text, i) => (
                <p key={i} aria-hidden className="invisible [grid-area:1/1]">
                  {text}
                </p>
              ))}
              <p aria-hidden className="[grid-area:1/1]">
                {shown}
              </p>
            </div>
            <p aria-live="polite" className="sr-only">
              {answer ? `${guideLabel} answers: ${answer.answer}` : `Stop ${index + 1} of ${TOTAL}: ${stop.name}. ${stop.text}`}
            </p>
            <p aria-hidden className={cn("mt-2 hidden text-xs text-white/75 lg:block", done && "invisible")}>
              Press Enter or click the text to show it all
            </p>

            {/* Perguntas ao guia: aparecem quando a fala acaba (o espaço fica reservado para nada saltar) */}
            {stop.questions.length > 0 && (
              <div className={cn("mt-4 short:mt-2", !showQuestions && "invisible")}>
                <p id={askId} className="text-xs font-semibold tracking-wide text-white/80 uppercase short:sr-only">
                  Ask {guideName}
                </p>
                <div role="group" aria-labelledby={askId} className="mt-2 flex flex-wrap gap-2 short:mt-0">
                  {stop.questions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      aria-pressed={question === q.id}
                      onClick={() => ask(q.id)}
                      className={cn(
                        "focus-on-dark inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm font-medium ring-1 transition short:min-h-9 short:text-xs",
                        question === q.id ? "bg-white text-kampus-navy ring-white" : "bg-white/10 text-white ring-white/25 hover:bg-white/20",
                      )}
                    >
                      {q.label}
                      {asked.has(q.id) && question !== q.id && (
                        <>
                          <Check aria-hidden className="size-4 shrink-0 text-kampus-sky" />
                          <span className="sr-only">(asked)</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!speech.supported && (
              <p id={audioHintId} className="mt-2 text-xs text-white/75">
                Audio isn't supported in this browser
              </p>
            )}

            {/* Controlos: fila fixa em baixo no telemóvel, dentro da caixa no desktop */}
            <div className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap gap-2 border-t border-white/10 bg-kampus-ink px-4 pt-3 short:flex-nowrap short:bg-kampus-ink/95 short:pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
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
