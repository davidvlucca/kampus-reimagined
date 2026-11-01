import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { CameraRig, type Insets } from "./CameraRig.tsx";
import { CampusModel } from "./CampusModel.tsx";
import { highlightRoom, roomOfStop } from "./layout.ts";
import { COLORS } from "./materials.ts";
import { LabelProjector, RoomLabels } from "./RoomLabels.tsx";
import { FURNITURE } from "./rooms/index.tsx";

export interface CampusMapProps {
  /** Paragem atual. */
  index: number;
  /** Vista geral ou dentro da sala da paragem. */
  view: "map" | "room";
  /** Paragem cuja sala fica acesa como "a seguinte" (null: nenhuma). */
  nextIndex: number | null;
  insets: Insets;
  /** Sem voos nem pulso (reduced motion com o 3D escolhido à mão). */
  instant: boolean;
  onSelectStop: (index: number) => void;
  /** O contexto WebGL perdeu-se: a visita segue em 2D. */
  onLost: () => void;
  /** O primeiro frame já foi desenhado. */
  onReady: () => void;
}

/**
 * A planta 3D do campus. É só decoração para leitores de ecrã (aria-hidden): tudo o que
 * se faz aqui também se faz com os botões das paragens. Carregada à parte (React.lazy),
 * para o three.js só ser descarregado quando o 3D vai mesmo ser usado.
 */
export default function CampusMap({ index, view, nextIndex, insets, instant, onSelectStop, onLost, onReady }: CampusMapProps) {
  const cameraRoom = view === "room" ? roomOfStop(index) : null;
  const highlight = highlightRoom(nextIndex);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <Canvas
        // Sem tone mapping: as cores do Kampus aparecem como são (o ACES escurecia os brancos).
        flat
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ fov: 35, near: 0.5, far: 200, position: [0, 30, 30] }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            onLost();
          });
          requestAnimationFrame(onReady);
        }}
      >
        <color attach="background" args={[COLORS.ink]} />
        <hemisphereLight args={["#FFFFFF", "#7FA6D6", 2.2]} />
        <directionalLight position={[6, 14, 8]} intensity={1.4} />
        <CampusModel highlight={highlight} animate={!instant} onSelectStop={onSelectStop} furniture={FURNITURE} />
        <CameraRig room={cameraRoom} insets={insets} instant={instant} />
        <LabelProjector labels={labels} />
      </Canvas>
      <RoomLabels labels={labels} show={view === "map"} highlight={highlight} />
    </div>
  );
}
