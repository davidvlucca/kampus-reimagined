import { useEffect, useState, type RefObject } from "react";
import type { Insets } from "./three/CameraRig.tsx";

const NO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

interface Refs {
  scene: RefObject<HTMLElement | null>;
  header: RefObject<HTMLElement | null>;
  card: RefObject<HTMLElement | null>;
  controls: RefObject<HTMLElement | null>;
}

const sameInsets = (a: Insets, b: Insets) => a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;

/**
 * A faixa do canvas que fica livre (o topo e o diálogo tapam partes dele no desktop e deitado).
 * `layoutKey` muda quando o que está por cima muda (ex.: a vista), para voltar a medir.
 */
export function useCanvasInsets(enabled: boolean, layoutKey: string, refs: Refs): Insets {
  const [insets, setInsets] = useState<Insets>(NO_INSETS);
  const { scene: sceneRef, header: headerRef, card: cardRef, controls: controlsRef } = refs;

  useEffect(() => {
    if (!enabled) return;
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
      setInsets((cur) => (sameInsets(cur, next) ? cur : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [sceneRef.current, headerRef.current, cardRef.current, controlsRef.current]) if (el) observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, layoutKey, sceneRef, headerRef, cardRef, controlsRef]);

  return insets;
}
