import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { Vector3 } from "three";
import { ROOFTOP, ROOMS, WALL_H, wx, wz, type RoomId } from "./layout.ts";

// As etiquetas das salas são DOM normal por cima do canvas (texto nítido, sem fontes 3D).
// Dentro do canvas, `LabelProjector` só calcula onde cada uma fica no ecrã a cada frame.

// Só as paragens têm etiqueta. O terraço não se vê no mapa: a etiqueta fica por cima das escadas
// (e do pino) e sobe mais uma altura de etiqueta, numa fila própria; à altura das outras tapava-as
// no telemóvel deitado.
const LABELED = [...ROOMS.filter((r) => r.label !== null), ROOFTOP];
const anchors = LABELED.map((r) => (r === ROOFTOP ? new Vector3(wx(11.2), WALL_H + 3.3, wz(17)) : new Vector3(r.x, WALL_H + 0.4, r.z)));
const v = new Vector3();

export type LabelRefs = RefObject<(HTMLSpanElement | null)[]>;

/** Espaço mínimo, em px, entre a etiqueta do terraço e outra em que tocasse. */
const LABEL_GAP = 3;

export function LabelProjector({ labels }: { labels: LabelRefs }) {
  useFrame(({ camera, size }) => {
    // A câmara pode ter mudado neste frame (ex.: ao redimensionar com ela parada) e o renderer só
    // atualiza as matrizes depois: sem isto as etiquetas ficavam na posição antiga, fora do ecrã.
    camera.updateMatrixWorld();
    // O centro e o tamanho de cada etiqueta no ecrã.
    const boxes = anchors.map((anchor, i) => {
      const el = labels.current[i];
      if (!el) return null;
      v.copy(anchor).project(camera);
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      // As das salas ficam centradas no ponto; a do terraço sobe mais uma altura de etiqueta.
      const rise = LABELED[i] === ROOFTOP ? 1.1 * h : 0;
      return { el, w, h, x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height - rise };
    });
    // A do terraço não é de nenhuma sala do mapa: num ecrã ao alto caía em cima da "Open space".
    // Afasta-se da etiqueta em que toca, para o lado em que já está.
    // shortcut: uma só passagem (pode encostar a uma terceira); com mais etiquetas soltas, repetir até não tocar.
    const roof = boxes[LABELED.indexOf(ROOFTOP)];
    if (roof) {
      for (const other of boxes) {
        if (!other || other === roof) continue;
        const dy = roof.y - other.y;
        const reach = (roof.h + other.h) / 2 + LABEL_GAP;
        if (Math.abs(roof.x - other.x) < (roof.w + other.w) / 2 && Math.abs(dy) < reach) roof.y = other.y + (dy < 0 ? -reach : reach);
      }
    }
    for (const box of boxes) {
      if (!box) continue;
      box.el.style.transform = `translate(-50%, -50%) translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
      box.el.style.visibility = "visible";
    }
  });
  return null;
}

/** Só visual (o contentor é aria-hidden): os nomes acessíveis vêm dos botões das paragens. */
export function RoomLabels({ labels, show, highlight }: { labels: LabelRefs; show: boolean; highlight: RoomId | null }) {
  return (
    <div className={"pointer-events-none absolute inset-0 overflow-hidden transition-opacity " + (show ? "opacity-100" : "opacity-0")}>
      {LABELED.map((room, i) => (
        <span
          key={room.id}
          ref={(el) => {
            labels.current[i] = el;
          }}
          style={{ visibility: "hidden" }}
          className={
            "absolute top-0 left-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm select-none short:px-2 short:text-[0.6875rem] big:text-sm huge:text-base " +
            (highlight === room.id ? "bg-white text-kampus-navy" : "bg-kampus-navy/85 text-white")
          }
        >
          {room.label}
        </span>
      ))}
    </div>
  );
}
