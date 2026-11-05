import { Canvas, type GLProps } from "@react-three/fiber";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { WebGLRenderer } from "three";
import { CameraRig, type Insets } from "./CameraRig.tsx";
import { CampusModel } from "./CampusModel.tsx";
import { highlightRoom, roomOfStop, type RoomId } from "./layout.ts";
import { COLORS, disposeShared } from "./materials.ts";
import { LabelProjector, RoomLabels } from "./RoomLabels.tsx";
import { FURNITURE } from "./rooms/index.tsx";
import { RoofLevel } from "./rooms/Rooftop.tsx";

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
  /** A câmara parou: dentro de uma sala (a ilustração dela pode aparecer) ou na vista geral (null). */
  onArrive: (room: RoomId | null) => void;
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
function CampusMap({ index, view, nextIndex, insets, instant, onSelectStop, onArrive, onLost, onReady }: CampusMapProps) {
  const cameraRoom = view === "room" ? roomOfStop(index) : null;
  // No mapa acende a sala seguinte (é aí que se escolhe para onde ir). Dentro de uma sala acende
  // a própria sala, sem pino: acender a seguinte parecia que o clique tinha ido parar a outra sala.
  const highlight = view === "room" ? cameraRoom : highlightRoom(nextIndex);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  // Com o terraço por cima, as etiquetas das salas lá de baixo ficavam a flutuar em cima dele.
  const [roof, setRoof] = useState(false);
  // Ao desmontar, o R3F força a perda do contexto (meio segundo depois). Isso não é uma
  // falha: sem esta guarda aparecia o aviso "Showing the 2D tour" ao sair da visita.
  const alive = useRef(true);
  const onLostRef = useRef(onLost);

  useEffect(() => {
    onLostRef.current = onLost;
  }, [onLost]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // As geometrias e os materiais são partilhados: liberta-os da GPU (voltam a subir se o 3D voltar).
      disposeShared();
    };
  }, []);

  // O contexto pode já chegar perdido (o browser tira-o nos primeiros instantes, ou outro script
  // usou este canvas antes): o three.js rebentava ao ler a precisão dos shaders, com dois erros na
  // consola antes do 2D. Assim passa logo ao 2D. A promessa fica pendente: o canvas vai desmontar.
  const createRenderer = useCallback<Extract<GLProps, (defaults: never) => Promise<unknown>>>(({ canvas }) => {
    const attributes = { alpha: true, antialias: true, powerPreference: "low-power" } as const;
    const context = (canvas as HTMLCanvasElement).getContext("webgl2", attributes) as WebGL2RenderingContext | null;
    if (!context || context.isContextLost()) {
      if (alive.current) onLostRef.current();
      return new Promise(() => {});
    }
    return Promise.resolve(new WebGLRenderer({ ...attributes, canvas: canvas as HTMLCanvasElement, context }));
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-0" data-lit-room={highlight ?? ""}>
      <Canvas
        // Sem tone mapping: as cores do Kampus aparecem como são (o ACES escurecia os brancos).
        flat
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ fov: 35, near: 0.5, far: 200, position: [0, 30, 30] }}
        gl={createRenderer}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            // Um canvas que já saiu da página está a ser desmontado (sair da visita, trocar para 2D):
            // não é uma falha, mesmo que o browser dispare a perda antes da limpeza do React.
            if (!alive.current || !gl.domElement.isConnected) return;
            event.preventDefault();
            onLostRef.current();
          });
          requestAnimationFrame(onReady);
        }}
      >
        <color attach="background" args={[COLORS.ink]} />
        <hemisphereLight args={["#FFFFFF", "#7FA6D6", 2.2]} />
        <directionalLight position={[6, 14, 8]} intensity={1.4} />
        <CampusModel highlight={highlight} focus={cameraRoom} pin={view === "map"} animate={!instant} onSelectStop={onSelectStop} furniture={FURNITURE} />
        <RoofLevel shown={cameraRoom === "rooftop"} animate={!instant} onPresent={setRoof} />
        <CameraRig room={cameraRoom} insets={insets} instant={instant} onSettled={onArrive} />
        <LabelProjector labels={labels} />
      </Canvas>
      <RoomLabels labels={labels} show={view === "map" && !roof} highlight={highlight} />
    </div>
  );
}

// Memo: a TourPage volta a renderizar a cada letra da fala; o 3D só quando as props mudam
// (senão desenhava ~20 frames por segundo enquanto o texto se escreve).
export default memo(CampusMap);
