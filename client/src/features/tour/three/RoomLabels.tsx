import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { Vector3 } from "three";
import { ROOFTOP, ROOMS, WALL_H, wx, wz, type RoomId } from "./layout.ts";

// As etiquetas das salas são DOM normal por cima do canvas (texto nítido, sem fontes 3D).
// Dentro do canvas, `LabelProjector` só calcula onde cada uma fica no ecrã a cada frame.

// Só as paragens têm etiqueta. O terraço não se vê no mapa: a etiqueta fica por cima das escadas.
const LABELED = [...ROOMS.filter((r) => r.label !== null), ROOFTOP];
const anchors = LABELED.map((r) => (r === ROOFTOP ? new Vector3(wx(11.2), WALL_H + 2.6, wz(17)) : new Vector3(r.x, WALL_H + 0.4, r.z)));
const v = new Vector3();

export type LabelRefs = RefObject<(HTMLSpanElement | null)[]>;

export function LabelProjector({ labels }: { labels: LabelRefs }) {
  useFrame(({ camera, size }) => {
    // A câmara pode ter mudado neste frame (ex.: ao redimensionar com ela parada) e o renderer só
    // atualiza as matrizes depois: sem isto as etiquetas ficavam na posição antiga, fora do ecrã.
    camera.updateMatrixWorld();
    anchors.forEach((anchor, i) => {
      const el = labels.current[i];
      if (!el) return;
      v.copy(anchor).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.visibility = "visible";
    });
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
            "absolute top-0 left-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm select-none big:text-sm huge:text-base " +
            (highlight === room.id ? "bg-white text-kampus-navy" : "bg-kampus-navy/85 text-white")
          }
        >
          {room.label}
        </span>
      ))}
    </div>
  );
}
