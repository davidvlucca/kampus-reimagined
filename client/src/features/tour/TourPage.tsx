import { CAMPUS_NAME, GUIDES, guideImage, TOUR_STOPS } from "@kampus/shared";
import { Check, ChevronLeft, ChevronRight, Map as MapIcon, Square, Volume2, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
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
import type { Insets } from "./three/CameraRig.tsx";
import { Tour3DErrorBoundary } from "./three/ErrorBoundary.tsx";
import { highlightRoom, roomOfStop, type RoomId } from "./three/layout.ts";
import { canUseWebGL } from "./three/webgl.ts";

// O three.js só é descarregado quando a planta 3D vai mesmo aparecer.
const CampusMap = lazy(() => import("./three/CampusMap.tsx"));

type TourMode = "2d" | "3d";
const MODE_KEY = "kampus.tourMode";

function readModePref(): TourMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "2d" || v === "3d" ? v : null;
  } catch {
    return null;
  }
}

function saveModePref(mode: TourMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Sem armazenamento (modo privado): a escolha vale só para esta visita.
  }
}

const NO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

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
  const mapTitleId = useId();

  // 3D por omissão; 2D com reduced motion, sem WebGL, se o WebGL falhar ou se a pessoa escolher.
  const [lost, setLost] = useState(false);
  const [modePref, setModePref] = useState<TourMode | null>(readModePref);
  const webgl = canUseWebGL() && !lost;
  const is3D = webgl && (modePref ? modePref === "3d" : !reducedMotion);
  // No 3D: vista geral ("map") ou dentro da sala da paragem ("room"). No 2D é sempre "room".
  const [view, setView] = useState<"map" | "room">("map");
  const [mapReady, setMapReady] = useState(false);
  const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set());
  const inRoom = !is3D || view === "room";
  // A sala onde a câmara parou. Quando é a da paragem, a ilustração do 2D aparece por cima: "entrou-se".
  const [arrived, setArrived] = useState<RoomId | null>(null);
  const [insets, setInsets] = useState<Insets>(NO_INSETS);
  const sceneRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const mapHeadingRef = useRef<HTMLHeadingElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const focusAfterViewChange = useRef(false);

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

  const { stop: stopSpeech } = speech;
  const markVisited = useCallback((i: number) => setVisited((v) => (v.has(i) ? v : new Set(v).add(i))), []);
  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(TOTAL - 1, next));
      if (target === index) return;
      stopSpeech();
      // Sai da ilustração: a câmara vai à vista geral e mergulha na sala nova.
      setArrived(null);
      setQuestion(null);
      setScenes({ index: target, prev: index });
      if (view === "room") markVisited(target);
    },
    [index, stopSpeech, view, markVisited],
  );

  /**
   * Se o foco está no que vai desaparecer (o cartão do diálogo ou do mapa, ou o botão
   * "Back to map" por cima do 3D), segue para o cartão novo.
   */
  const keepFocus = useCallback(() => {
    const active = document.activeElement;
    if (cardRef.current?.contains(active) || (active instanceof HTMLElement && active.dataset.backToMap !== undefined)) {
      focusAfterViewChange.current = true;
    }
  }, []);

  /** 3D: entra na sala de uma paragem (a câmara voa até lá e o diálogo abre). */
  const enterRoom = useCallback(
    (i: number, { focusDialog = false } = {}) => {
      if (view === "room") {
        // Já na sala: o cartão não muda, por isso não há foco a passar (só o clique no 3D o pede).
        if (focusDialog) cardRef.current?.focus({ preventScroll: true });
      } else {
        keepFocus();
        if (focusDialog) focusAfterViewChange.current = true;
      }
      goTo(i);
      markVisited(i);
      setView("room");
    },
    [goTo, keepFocus, markVisited, view],
  );
  // Identidade fixa para o 3D (memo): com o enterRoom direto, mudava a cada letra da fala e o
  // canvas voltava a desenhar enquanto o texto se escreve.
  const enterRoomRef = useRef(enterRoom);
  useEffect(() => {
    enterRoomRef.current = enterRoom;
  }, [enterRoom]);
  const selectFromMap = useCallback((i: number) => enterRoomRef.current(i, { focusDialog: true }), []);
  const onMapReady = useCallback(() => setMapReady(true), []);
  const introDone = useRef(false);

  const backToMap = useCallback(() => {
    keepFocus();
    stopSpeech();
    setArrived(null);
    setView("map");
  }, [keepFocus, stopSpeech]);

  // Na vista geral, a sala seguinte é a da paragem atual se ainda não se entrou nela.
  const mapNext = visited.has(index) ? Math.min(index + 1, TOTAL - 1) : index;
  const nextIndex = view === "map" ? mapNext : index + 1 < TOTAL ? index + 1 : null;

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

  // Teclado: ← → mudam de paragem, Enter mostra o texto todo ou avança, Esc sai (no 3D,
  // dentro de uma sala, Esc volta primeiro ao mapa). Sair não marca a visita como saltada.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        // Manter o Esc carregado ia da sala ao mapa e logo a seguir para fora da visita.
        if (event.repeat) return;
        if (is3D && view === "room") backToMap();
        else exit();
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
        if (!inRoom) enterRoom(mapNext);
        else if (done) next();
        else finish();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backToMap, done, enterRoom, exit, finish, goTo, inRoom, index, is3D, mapNext, next, view]);

  // 3D: começa na vista geral e, ao fim de um momento (contado a partir do primeiro frame,
  // não do clique: num telemóvel lento o 3D demora a carregar), voa para a Entrance.
  // Só acontece uma vez por visita, e só se a pessoa ainda não escolheu nenhuma sala.
  useEffect(() => {
    if (!is3D || !mapReady || introDone.current) return;
    const id = window.setTimeout(() => {
      introDone.current = true;
      // Se a pessoa já mudou de paragem no mapa (setas, botões), não entra sozinha noutra sala.
      if (view !== "map" || visited.size > 0 || index !== 0) return;
      keepFocus();
      markVisited(index);
      setView("room");
    }, 1200);
    return () => window.clearTimeout(id);
  }, [is3D, mapReady, view, visited, index, keepFocus, markVisited]);

  // Depois de mudar de vista, o foco passa para o cartão novo (se estava no que desapareceu).
  useEffect(() => {
    if (!focusAfterViewChange.current) return;
    focusAfterViewChange.current = false;
    (is3D && view === "map" ? mapHeadingRef.current : cardRef.current)?.focus({ preventScroll: true });
  }, [view, is3D]);

  // A faixa do canvas que fica livre (o topo e o diálogo tapam partes dele no desktop e deitado).
  useEffect(() => {
    if (!is3D) return;
    const measure = () => {
      const scene = sceneRef.current?.getBoundingClientRect();
      if (!scene) return;
      const overlaps = (r: DOMRect | undefined): r is DOMRect =>
        Boolean(r && r.height > 0 && r.top < scene.bottom && r.bottom > scene.top && r.left < scene.right && r.right > scene.left);
      const clampY = (v: number) => Math.round(Math.max(0, Math.min(scene.height, v)));
      const clampX = (v: number) => Math.round(Math.max(0, Math.min(scene.width, v)));
      const header = headerRef.current?.getBoundingClientRect();
      const card = cardRef.current?.getBoundingClientRect();
      const controls = controlsRef.current?.getBoundingClientRect();
      const next: Insets = { top: overlaps(header) ? clampY(header.bottom - scene.top) : 0, bottom: 0, left: 0, right: 0 };
      if (overlaps(controls)) next.bottom = clampY(scene.bottom - controls.top);
      if (overlaps(card)) {
        // A sala vai para o maior espaço livre: por cima do cartão ou à esquerda dele.
        const above = (card.top - scene.top - next.top) * scene.width;
        const beside = (card.left - scene.left) * (scene.height - next.top - next.bottom);
        if (beside > above) next.right = clampX(scene.right - card.left + 12);
        else next.bottom = Math.max(next.bottom, clampY(scene.bottom - card.top + 12));
      }
      setInsets((cur) => (cur.top === next.top && cur.bottom === next.bottom && cur.left === next.left && cur.right === next.right ? cur : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [sceneRef.current, headerRef.current, cardRef.current, controlsRef.current]) if (el) observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [is3D, view]);

  const onLost = useCallback(() => {
    // O 3D desaparece: se o foco estava nele (cartão do mapa ou "Back to map"), vai para o diálogo 2D.
    keepFocus();
    setLost(true);
    setMapReady(false);
    toast({ title: "Showing the 2D tour", description: "3D isn't available on this device right now.", tone: "info" });
  }, [keepFocus, toast]);

  function switchMode() {
    const mode: TourMode = is3D ? "2d" : "3d";
    saveModePref(mode);
    setModePref(mode);
    // Ao mudar a meio da visita: o 3D entra já na sala da paragem atual, sem a introdução.
    introDone.current = true;
    markVisited(index);
    setMapReady(false);
    setArrived(null);
    setView("room");
  }

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
  const interior = is3D && view === "room" && arrived !== null && arrived === roomOfStop(index);
  const [lastInterior, setLastInterior] = useState<number | null>(null);
  if (interior && lastInterior !== index) setLastInterior(index);
  const interiorStop = lastInterior !== null ? TOUR_STOPS[lastInterior] : undefined;
  const darkButton = "focus-on-dark ring-1 ring-white/25 grow lg:grow-0";

  return (
    <div
      data-tour-mode={is3D ? "3d" : "2d"}
      data-tour-view={is3D ? view : undefined}
      data-tour-interior={is3D ? (interior ? (arrived ?? "") : "") : undefined}
      data-next-room={is3D ? (highlightRoom(nextIndex) ?? "") : undefined}
      className="relative flex min-h-dvh flex-col overflow-x-hidden bg-kampus-ink text-white short:h-dvh short:overflow-hidden lg:h-dvh lg:overflow-hidden"
    >
      <h1 className="sr-only">Virtual tour of {CAMPUS_NAME}</h1>

      {/* Topo: logótipo, contador, progresso, saltar e sair. No portátil fica por cima do 3D: as partes
          vazias (e o degradê) deixam passar o clique para as salas que estão por baixo. */}
      <header ref={headerRef} className="pointer-events-none relative z-20 flex *:pointer-events-auto flex-wrap items-center gap-x-3 max-[359px]:gap-x-2 big:[zoom:1.25] huge:[zoom:1.5] gap-y-1 px-4 pt-3 pb-1 short:absolute short:inset-x-0 short:top-0 short:flex-nowrap short:bg-linear-to-b short:from-kampus-ink/90 short:to-transparent short:pb-6 lg:absolute lg:inset-x-0 lg:top-0 lg:flex-nowrap lg:gap-6 lg:bg-linear-to-b lg:from-kampus-ink/85 lg:via-kampus-ink/50 lg:to-transparent lg:px-10 lg:pt-5 lg:pb-12">
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
          <span className="truncate text-sm font-medium text-white/90">{stop.name}</span>
        </p>
        <TourProgress index={index} onGo={is3D ? (i) => enterRoom(i) : goTo} className="order-last w-full short:order-none short:w-auto short:flex-1 lg:order-none lg:w-auto lg:max-w-xl lg:flex-1" />
        {webgl && (
          <button
            type="button"
            onClick={switchMode}
            className="rounded-md px-1 text-sm text-white/85 underline underline-offset-4 hover:text-white focus-on-dark lg:ml-auto"
          >
            {/* No telemóvel só "2D"/"3D" à vista; o nome completo fica para leitores de ecrã. */}
            <span className="sr-only lg:not-sr-only">Switch to </span>
            {is3D ? "2D" : "3D"}
            <span className="sr-only"> tour</span>
          </button>
        )}
        {canSkip && (
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className={cn("rounded-md px-1 text-sm text-white/85 underline underline-offset-4 hover:text-white focus-on-dark disabled:opacity-55", !webgl && "lg:ml-auto")}
          >
            Skip tour
          </button>
        )}
        <IconButton label="Exit tour" icon={<X aria-hidden />} variant="onDark" onClick={exit} className={cn(!canSkip && !webgl && "lg:ml-auto")} />
      </header>

      {/* Cenário */}
      <div
        ref={sceneRef}
        className={cn(
          // No telemóvel e no tablet ao alto o cenário fica com o espaço que o diálogo deixa (sem vazios).
          "relative min-h-[24dvh] flex-1 overflow-hidden bg-kampus-ink short:absolute short:inset-0 short:h-auto lg:absolute lg:inset-0 lg:h-auto",
        )}
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
                onArrive={setArrived}
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
            <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-linear-to-t from-kampus-ink/70 via-transparent to-transparent short:block lg:block" />
          </div>
        )}
        {is3D && inRoom && (
          // Por cima do 3D, como nas apps de mapas (fora do canvas, que é só decoração).
          <Button
            variant="light"
            size="sm"
            icon={<MapIcon aria-hidden className="size-4" />}
            onClick={backToMap}
            data-back-to-map=""
            style={{ top: insets.top + 12 }}
            className="absolute left-4 z-10 shadow-pop lg:left-10 big:[zoom:1.25] huge:[zoom:1.5]"
          >
            Back to map
          </Button>
        )}
        {!is3D && (
          <>
            {prevStop && (
              <div aria-hidden>
                <SceneImage key={`prev-${prev}`} scene={prevStop.scene} alt="" fade={false} />
              </div>
            )}
            <SceneImage key={index} scene={stop.scene} alt={stop.sceneAlt} />
            <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-linear-to-t from-kampus-ink/70 via-transparent to-transparent short:block lg:block" />
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
      <main
        className={cn(
          "relative z-10 flex flex-none flex-col px-4 pt-4 short:absolute short:top-12 short:bottom-0 short:justify-end short:flex-none short:pt-0 short:pb-[4.75rem] lg:absolute lg:inset-x-0 lg:bottom-0 lg:px-10 lg:pt-0 lg:pb-8",
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
            <section
              ref={cardRef}
              aria-labelledby={mapTitleId}
              className="pointer-events-auto relative rounded-[var(--radius-card)] bg-kampus-navy/95 p-5 shadow-pop ring-1 ring-white/15 short:min-h-0 short:overflow-y-auto short:p-3.5 lg:mx-auto lg:max-w-xl lg:backdrop-blur"
            >
              <h2 id={mapTitleId} ref={mapHeadingRef} tabIndex={-1} className="font-display text-lg font-semibold text-white outline-none short:text-base">
                Campus map
              </h2>
              <p className="mt-1 text-sm text-white/85">Choose a room on the map, or carry on with the tour.</p>
              <Button variant="light" onClick={() => enterRoom(mapNext)} className="mt-4 w-full sm:w-auto short:mt-2">
                {visited.size === 0 ? "Start at the Entrance" : `Continue to ${TOUR_STOPS[mapNext]!.name}`}
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </section>
          ) : (
          <>
          <GuidePortrait
            guide={stop.guide}
            face={mouthOpen ? "talk" : mood}
            className="absolute -bottom-8 left-0 hidden h-[min(58dvh,520px)] lg:grid"
            imgClassName="h-full w-auto"
          />
          <section
            ref={cardRef}
            tabIndex={-1}
            aria-label="Guide"
            className="pointer-events-auto relative rounded-[var(--radius-card)] bg-kampus-navy/95 p-5 shadow-pop ring-1 ring-white/15 short:min-h-0 short:overflow-y-auto short:p-3.5 lg:ml-72 lg:backdrop-blur lg:p-7"
          >
            <div className="flex items-center gap-3">
              <GuidePortrait
                guide={stop.guide}
                face={mouthOpen ? "talk" : mood}
                className="size-14 shrink-0 overflow-hidden rounded-full bg-kampus-sky-soft ring-2 ring-kampus-sky short:size-9 md:size-20 lg:hidden"
                imgClassName="size-full object-cover object-top"
              />
              <p className="rounded-lg bg-kampus-sky px-3 py-1 text-sm font-semibold text-kampus-ink">{guideLabel}</p>
            </div>

            {/* Clicar no texto mostra-o todo (no teclado: Enter) */}
            <div onClick={finish} className={cn("mt-4 grid text-base leading-relaxed short:mt-2 short:text-sm md:text-lg", !done && "cursor-pointer")}>
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
            <div ref={controlsRef} className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap gap-2 border-t border-white/10 bg-kampus-ink px-4 pt-3 short:flex-nowrap short:bg-kampus-ink/95 short:pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
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
                {/* Num ecrã de 320 px só o ícone, para os botões caberem numa fila (o nome fica para leitores de ecrã) */}
                <span className="max-[359px]:sr-only">{speech.speaking ? "Stop audio" : "Play audio"}</span>
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
          </>
          )}
        </div>
      </main>
    </div>
  );
}
