import { TOUR_STOPS } from "@kampus/shared";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { roomOfStop, type RoomId } from "./three/layout.ts";

export const TOTAL = TOUR_STOPS.length;

export type TourView = "map" | "room";

interface Options {
  is3D: boolean;
  /** O primeiro frame do 3D já foi desenhado (a introdução conta a partir daí). */
  mapReady: boolean;
  cardRef: RefObject<HTMLElement | null>;
  mapHeadingRef: RefObject<HTMLHeadingElement | null>;
  nextRef: RefObject<HTMLButtonElement | null>;
  stopSpeech: () => void;
  /** Chamado ao mudar de paragem (a pergunta feita fica para trás). */
  onStopChange: () => void;
}

/**
 * Onde se está na visita: a paragem, a vista (no 3D, o mapa ou dentro da sala), as salas
 * onde já se entrou e para onde vai o foco quando o que o tinha desaparece.
 */
export function useTourNavigation({ is3D, mapReady, cardRef, mapHeadingRef, nextRef, stopSpeech, onStopChange }: Options) {
  // No 3D: vista geral ("map") ou dentro da sala da paragem ("room"). No 2D é sempre "room".
  const [view, setView] = useState<TourView>("map");
  const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set());
  const inRoom = !is3D || view === "room";
  // A sala onde a câmara parou. Quando é a da paragem, a ilustração do 2D aparece por cima: "entrou-se".
  const [arrived, setArrived] = useState<RoomId | null>(null);
  const focusAfterViewChange = useRef(false);
  // Ao mudar de paragem, o botão com o foco pode desaparecer (as perguntas são outras) ou ficar
  // desativado (o Back na primeira): o foco não pode cair no <body>.
  const focusAfterStopChange = useRef(false);
  const introDone = useRef(false);

  // `prev` fica por baixo enquanto o cenário novo aparece (fade).
  const [{ index, prev }, setScenes] = useState<{ index: number; prev: number | null }>({ index: 0, prev: null });

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(TOTAL - 1, next));
      if (target === index) return;
      if (cardRef.current?.contains(document.activeElement)) focusAfterStopChange.current = true;
      stopSpeech();
      // Sai da ilustração: a câmara vai à vista geral e mergulha na sala nova.
      setArrived(null);
      onStopChange();
      setScenes({ index: target, prev: index });
    },
    [index, cardRef, stopSpeech, onStopChange],
  );

  /**
   * Se o foco está no que vai desaparecer (o cartão do diálogo, com o "Back to map", ou o
   * do mapa), segue para o cartão novo.
   */
  const keepFocus = useCallback(() => {
    const active = document.activeElement;
    if (cardRef.current?.contains(active) || (active instanceof HTMLElement && active.dataset.backToMap !== undefined)) {
      focusAfterViewChange.current = true;
    }
  }, [cardRef]);

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
      setView("room");
    },
    [goTo, keepFocus, view, cardRef],
  );
  // Identidade fixa para o 3D (memo): com o enterRoom direto, mudava a cada letra da fala e o
  // canvas voltava a desenhar enquanto o texto se escreve.
  const enterRoomRef = useRef(enterRoom);
  useEffect(() => {
    enterRoomRef.current = enterRoom;
  }, [enterRoom]);
  const selectFromMap = useCallback((i: number) => enterRoomRef.current(i, { focusDialog: true }), []);

  const backToMap = useCallback(() => {
    keepFocus();
    stopSpeech();
    setArrived(null);
    setView("map");
  }, [keepFocus, stopSpeech]);

  /** Ao trocar de modo a meio da visita: o 3D entra já na sala da paragem atual, sem a introdução. */
  const enterCurrentRoom = useCallback(() => {
    introDone.current = true;
    setArrived(null);
    setView("room");
  }, []);

  // 3D: dentro da sala, a ilustração aparece por cima do canvas quando a câmara chega.
  const interior = is3D && view === "room" && arrived !== null && arrived === roomOfStop(index);
  // Uma paragem fica vista quando aparece: no 2D logo, no 3D só quando a câmara chega à sala
  // (sair para o mapa a meio do voo não conta, e o "Continue to" volta a propor essa sala).
  const seen = is3D ? (interior ? index : null) : index;
  if (seen !== null && !visited.has(seen)) setVisited(new Set(visited).add(seen));

  // Na vista geral, a sala seguinte é a da paragem atual se ainda não se entrou nela.
  const mapNext = visited.has(index) ? Math.min(index + 1, TOTAL - 1) : index;
  const nextIndex = view === "map" ? mapNext : index + 1 < TOTAL ? index + 1 : null;

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
      setView("room");
    }, 1200);
    return () => window.clearTimeout(id);
  }, [is3D, mapReady, view, visited, index, keepFocus]);

  useEffect(() => {
    if (!focusAfterStopChange.current) return;
    focusAfterStopChange.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected && !(active as HTMLButtonElement).disabled) return;
    (index === 0 ? nextRef.current : cardRef.current)?.focus({ preventScroll: true });
  }, [index, nextRef, cardRef]);

  // Depois de mudar de vista, o foco passa para o cartão novo (se estava no que desapareceu).
  useEffect(() => {
    if (!focusAfterViewChange.current) return;
    focusAfterViewChange.current = false;
    (is3D && view === "map" ? mapHeadingRef.current : cardRef.current)?.focus({ preventScroll: true });
  }, [view, is3D, mapHeadingRef, cardRef]);

  return {
    index,
    prev,
    view,
    inRoom,
    visited,
    arrived,
    setArrived,
    interior,
    mapNext,
    nextIndex,
    goTo,
    enterRoom,
    selectFromMap,
    backToMap,
    enterCurrentRoom,
    keepFocus,
  };
}
