import { useEffect } from "react";

// Elementos onde Enter/espaço já fazem alguma coisa: aí não mexemos.
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("button, a, input, textarea, select, [role='button']") !== null;
}

interface Options {
  /** No 3D, dentro de uma sala (o Esc volta primeiro ao mapa). */
  inRoom3D: boolean;
  /** O diálogo está à vista (no 3D, dentro de uma sala; no 2D, sempre). */
  inRoom: boolean;
  /** A fala já está toda escrita. */
  done: boolean;
  index: number;
  mapNext: number;
  goTo: (i: number) => void;
  enterRoom: (i: number) => void;
  backToMap: () => void;
  exit: () => void;
  next: () => void;
  finish: () => void;
}

/**
 * Teclado: ← → mudam de paragem, Enter mostra o texto todo ou avança, Esc sai (no 3D,
 * dentro de uma sala, Esc volta primeiro ao mapa). Sair não marca a visita como saltada.
 */
export function useTourKeyboard({ inRoom3D, inRoom, done, index, mapNext, goTo, enterRoom, backToMap, exit, next, finish }: Options) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        // Manter o Esc carregado ia da sala ao mapa e logo a seguir para fora da visita.
        if (event.repeat) return;
        if (inRoom3D) backToMap();
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
  }, [backToMap, done, enterRoom, exit, finish, goTo, inRoom, inRoom3D, index, mapNext, next]);
}
