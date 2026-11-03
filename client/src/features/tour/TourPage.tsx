import { CAMPUS_NAME, GUIDES, guideImage, TOUR_STOPS } from "@kampus/shared";
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useCompleteTour, useContacts, useCurrentUser, useSkipTour } from "../../api/hooks.ts";
import { useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName } from "../../lib/format.ts";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";
import { GuideDialog } from "./GuideDialog.tsx";
import { MapCard } from "./MapCard.tsx";
import { preloadScene } from "./scene.ts";
import { SceneImage } from "./SceneImage.tsx";
import { Tour3DErrorBoundary } from "./three/ErrorBoundary.tsx";
import { highlightRoom } from "./three/layout.ts";
import { TourControls } from "./TourControls.tsx";
import { TourHeader } from "./TourHeader.tsx";
import { useCanvasInsets } from "./useCanvasInsets.ts";
import { useMouthFlap } from "./useMouthFlap.ts";
import { useReducedMotion } from "./useReducedMotion.ts";
import { useSpeech } from "./useSpeech.ts";
import { useTourKeyboard } from "./useTourKeyboard.ts";
import { useTourMode, type TourMode } from "./useTourMode.ts";
import { TOTAL, useTourNavigation } from "./useTourNavigation.ts";
import { useTypewriter } from "./useTypewriter.ts";

// O three.js só é descarregado quando a planta 3D vai mesmo aparecer.
const CampusMap = lazy(() => import("./three/CampusMap.tsx"));

const sceneShade = "pointer-events-none absolute inset-0 hidden bg-linear-to-t from-kampus-ink/70 via-transparent to-transparent short:block lg:block";

export function TourPage() {
  useDocumentTitle("Campus tour");
  const user = useCurrentUser();
  const contacts = useContacts();
  const completeTour = useCompleteTour();
  const skipTour = useSkipTour();
  const toast = useToast();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const speech = useSpeech();
  const audioHintId = useId();

  const { webgl, is3D, choose: chooseMode, markLost } = useTourMode(reducedMotion);
  const [mapReady, setMapReady] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const mapHeadingRef = useRef<HTMLHeadingElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // A pergunta feita nesta paragem (a fala passa a ser a resposta) e as já feitas na visita.
  const [question, setQuestion] = useState<string | null>(null);
  const [asked, setAsked] = useState<ReadonlySet<string>>(() => new Set());
  const resetQuestion = useCallback(() => setQuestion(null), []);

  const { stop: stopSpeech } = speech;
  const nav = useTourNavigation({ is3D, mapReady, cardRef, mapHeadingRef, nextRef, stopSpeech, onStopChange: resetQuestion });
  const { index, prev, view, inRoom, visited, interior, mapNext, nextIndex, goTo, enterRoom, selectFromMap, backToMap, keepFocus } = nav;

  const stop = TOUR_STOPS[index]!;
  const guide = GUIDES[stop.guide];
  const isLast = index === TOTAL - 1;
  const answer = question ? stop.questions.find((q) => q.id === question) : undefined;
  const line = answer?.answer ?? stop.text;
  const mood = answer?.mood ?? stop.mood;

  // A fala recomeça ao entrar na sala: no 3D, enquanto se vê o mapa, o diálogo está escondido.
  const { shown, done, finish } = useTypewriter(line, `${index}:${question ?? ""}:${inRoom ? "room" : "map"}`, reducedMotion);
  const mouthOpen = useMouthFlap(inRoom && !done && !reducedMotion);
  // As perguntas aparecem quando a fala da paragem acaba e ficam visíveis daí em diante
  // (esconder o botão que tem o foco fazia o teclado perder o sítio).
  const showQuestions = done || question !== null || stop.questions.some((q) => asked.has(q.id));

  // Nome do guia a partir dos contactos; enquanto carrega ou se falhar, só o cargo.
  const guideContact = contacts.data?.find((c) => c.title === guide.title);
  const guideLabel = guideContact ? `${fullName(guideContact)} · ${guide.title}` : guide.title;
  const guideName = guideContact?.firstName ?? `the ${guide.title}`;

  const canSkip = !user.tourCompletedAt && !user.tourSkippedAt;
  const busy = completeTour.isPending || skipTour.isPending;

  const insets = useCanvasInsets(is3D, view, { scene: sceneRef, header: headerRef, card: cardRef, controls: controlsRef });
  const onMapReady = useCallback(() => setMapReady(true), []);

  const exit = useCallback(() => navigate("/app"), [navigate]);

  const complete = useCallback(() => {
    if (completeTour.isPending) return;
    // Refazer a visita não repete os parabéns.
    const firstTime = !user.tourCompletedAt;
    completeTour.mutate(undefined, {
      onSuccess: () => {
        if (firstTime) toast({ title: "Tour complete. Welcome to campus!", tone: "success" });
        navigate("/app");
      },
      onError: (error) => toast({ title: "Couldn't finish the tour", description: errorMessage(error), tone: "error" }),
    });
  }, [completeTour, user.tourCompletedAt, toast, navigate]);

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

  useTourKeyboard({ inRoom3D: is3D && view === "room", inRoom, done, index, mapNext, goTo, enterRoom, backToMap, exit, next, finish });

  const onLost = useCallback(() => {
    // O 3D desaparece: se o foco estava nele (cartão do mapa), vai para o diálogo 2D.
    keepFocus();
    markLost();
    setMapReady(false);
    toast({ title: "Showing the 2D tour", description: "3D isn't available on this device right now.", tone: "info" });
  }, [keepFocus, markLost, toast]);

  function switchMode(mode: TourMode) {
    if ((mode === "3d") === is3D) return;
    chooseMode(mode);
    setMapReady(false);
    nav.enterCurrentRoom();
  }

  // Ao abrir a visita, o foco fica no título (e não no <body>): o Tab segue daí para o diálogo e
  // o leitor de ecrã diz onde se está. A introdução do 3D não lhe mexe (o foco não está no cartão).
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) titleRef.current?.focus({ preventScroll: true });
  }, []);

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
  // 3D: a ilustração da sala por cima do canvas, com fade a entrar e a sair. A última mostrada
  // fica montada para o fade de saída (ao mudar de paragem, a nova só entra quando a câmara chega).
  const [lastInterior, setLastInterior] = useState<number | null>(null);
  if (interior && lastInterior !== index) setLastInterior(index);
  const interiorStop = lastInterior !== null ? TOUR_STOPS[lastInterior] : undefined;

  return (
    <div
      data-tour-mode={is3D ? "3d" : "2d"}
      data-tour-view={is3D ? view : undefined}
      data-tour-interior={is3D ? (interior ? (nav.arrived ?? "") : "") : undefined}
      data-next-room={is3D ? (highlightRoom(nextIndex) ?? "") : undefined}
      className={cn(
        "relative flex min-h-dvh flex-col overflow-x-hidden bg-kampus-ink text-white",
        "short:h-dvh short:overflow-hidden lg:h-dvh lg:overflow-hidden",
      )}
    >
      <TourHeader
        headerRef={headerRef}
        index={index}
        stopName={stop.name}
        onGo={is3D ? (i) => enterRoom(i) : goTo}
        webgl={webgl}
        is3D={is3D}
        onMode={switchMode}
        canSkip={canSkip}
        busy={busy}
        onSkip={skip}
        onExit={exit}
      />

      {/* O título, o cenário e o diálogo. Sem posição própria: no portátil e deitado, o cenário e o
          diálogo continuam posicionados em relação à página toda. */}
      <main className="flex flex-1 flex-col">
        <h1 ref={titleRef} tabIndex={-1} className="sr-only">
          Campus tour of {CAMPUS_NAME}
        </h1>

        {/* Cenário. No telemóvel e no tablet ao alto fica com o espaço que o diálogo deixa (sem vazios). */}
        <div
          ref={sceneRef}
          className="relative min-h-[24dvh] flex-1 overflow-hidden bg-kampus-ink short:absolute short:inset-0 short:h-auto lg:absolute lg:inset-0 lg:h-auto"
        >
          {is3D ? (
            <Tour3DErrorBoundary onError={onLost}>
              {!mapReady && (
                <p className="absolute inset-0 grid place-items-center text-sm text-white/75 motion-safe:animate-pulse">Loading the campus…</p>
              )}
              <Suspense fallback={null}>
                <CampusMap
                  index={index}
                  view={view}
                  nextIndex={nextIndex}
                  insets={insets}
                  instant={reducedMotion}
                  onSelectStop={selectFromMap}
                  onArrive={nav.setArrived}
                  onLost={onLost}
                  onReady={onMapReady}
                />
              </Suspense>
            </Tour3DErrorBoundary>
          ) : null}
          {is3D && (
            // Dentro da sala: a ilustração tapa o 3D (e os cliques nele) até se sair para o mapa.
            <div
              aria-hidden={!interior}
              className={cn(
                "absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none",
                interior ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {interiorStop && <SceneImage key={lastInterior} scene={interiorStop.scene} alt={interiorStop.sceneAlt} />}
              <div aria-hidden className={sceneShade} />
            </div>
          )}
          {!is3D && (
            <>
              {prevStop && (
                <div aria-hidden>
                  <SceneImage key={`prev-${prev}`} scene={prevStop.scene} alt="" fade={false} />
                </div>
              )}
              <SceneImage key={index} scene={stop.scene} alt={stop.sceneAlt} />
              <div aria-hidden className={sceneShade} />
            </>
          )}
        </div>

        {/* Anúncios para leitores de ecrã: a sala ou o mapa, e a fala */}
        <p aria-live="polite" className="sr-only">
          {!inRoom
            ? `Campus map. Next: ${TOUR_STOPS[mapNext]!.name}.`
            : answer
              ? `${guideLabel} answers: ${answer.answer}`
              : `Stop ${index + 1} of ${TOTAL}: ${stop.name}. ${stop.text}`}
        </p>

        {/* Guia e caixa de diálogo */}
        <div
          className={cn(
            "relative z-10 flex flex-none flex-col px-4 pt-4",
            "short:absolute short:top-12 short:bottom-0 short:flex-none short:justify-end short:pt-0 short:pb-[4.75rem]",
            "lg:absolute lg:inset-x-0 lg:bottom-0 lg:px-10 lg:pt-0 lg:pb-8",
            // No 3D deitado o diálogo fica à direita e a sala à esquerda (por baixo dele não se via nada).
            is3D ? "short:right-0 short:w-[58%]" : "short:inset-x-0",
            // À volta dos cartões (e por cima do guia, que é só imagem) o clique chega às salas do 3D.
            is3D && "pointer-events-none",
            // Espaço para a fila de botões fixa em baixo (só existe dentro de uma sala).
            inRoom ? "pb-[calc(5.25rem+env(safe-area-inset-bottom))]" : "pb-4",
            "big:[zoom:1.25] huge:[zoom:1.5]",
          )}
        >
          {/* Deitado e com muito pouca altura (ou zoom a 400%), o cartão não passa para cima do topo: rola por dentro */}
          <div className="relative mx-auto w-full max-w-6xl short:flex short:min-h-0 short:flex-col">
            {!inRoom ? (
              <MapCard
                cardRef={cardRef}
                headingRef={mapHeadingRef}
                atStart={visited.size === 0}
                nextName={TOUR_STOPS[mapNext]!.name}
                onContinue={() => enterRoom(mapNext)}
              />
            ) : (
              <GuideDialog
                cardRef={cardRef}
                stop={stop}
                face={mouthOpen ? "talk" : mood}
                guideLabel={guideLabel}
                guideName={guideName}
                line={line}
                shown={shown}
                done={done}
                finish={finish}
                question={question}
                asked={asked}
                onAsk={ask}
                showQuestions={showQuestions}
                speechSupported={speech.supported}
                audioHintId={audioHintId}
                finale={isLast}
                controls={
                  <TourControls
                    controlsRef={controlsRef}
                    nextRef={nextRef}
                    atFirst={index === 0}
                    isLast={isLast}
                    onBack={() => goTo(index - 1)}
                    onNext={next}
                    speechSupported={speech.supported}
                    speaking={speech.speaking}
                    onToggleAudio={toggleAudio}
                    audioHintId={audioHintId}
                    completing={completeTour.isPending}
                    skipping={skipTour.isPending}
                    onBackToMap={is3D ? backToMap : undefined}
                  />
                }
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
