import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Dim, useMat } from "./dim.ts";
import type { Group } from "three";
import { CORRIDOR, PLAN, ROOMS, stopOfRoom, WALL_H, WALL_T, WALLS, wx, wz, type Area, type Room, type RoomId, type WallPiece } from "./layout.ts";
import { BOX, COLORS, CYLINDER, mat, PLANE, SHADOW } from "./materials.ts";

const PULSE_S = 1.5;
/** Onde fica o pino quando a seguinte é o terraço: por cima das escadas do núcleo. */
const STAIRS_PIN: [number, number] = [wx(11.2), wz(17)];

/** Uma caixa da paleta: posição do centro e tamanho, em metros. */
export function Block({ p, s, color, rotY = 0 }: { p: [number, number, number]; s: [number, number, number]; color: string; rotY?: number }) {
  return <mesh geometry={BOX} material={useMat(color)} position={p} scale={s} rotation={[0, rotY, 0]} />;
}

export function Cylinder({ p, r, h, color }: { p: [number, number, number]; r: number; h: number; color: string }) {
  return <mesh geometry={CYLINDER} material={useMat(color)} position={p} scale={[r * 2, h, r * 2]} />;
}

/** Sombra falsa por baixo de uma peça: x, z do centro e tamanho (largura, fundo). */
export function Shadow({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  return <mesh geometry={PLANE} material={SHADOW} position={[x, 0.085, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[w, d, 1]} />;
}

/** Um troço de parede com o friso azul por cima. Numa janela: parapeito baixo e vidro azul-céu. */
function Wall({ wall }: { wall: WallPiece }) {
  const { x, z, length, alongX } = wall;
  const size = (h: number, t = WALL_T): [number, number, number] => (alongX ? [length, h, t] : [t, h, length]);
  if (wall.window) {
    const sill = 0.4;
    return (
      <>
        <Block p={[x, sill / 2, z]} s={size(sill)} color={COLORS.wall} />
        <Block p={[x, (sill + WALL_H) / 2, z]} s={size(WALL_H - sill, 0.06)} color={COLORS.sky} />
      </>
    );
  }
  return (
    <>
      <Block p={[x, WALL_H / 2, z]} s={size(WALL_H)} color={COLORS.wall} />
      <Block p={[x, WALL_H + 0.03, z]} s={size(0.06, WALL_T + 0.02)} color={COLORS.wallCap} />
    </>
  );
}

/** Pino por cima da sala seguinte, com um pulso curto quando muda. */
function NextPin({ animate, y = 2.4 }: { animate: boolean; y?: number }) {
  const ref = useRef<Group>(null);
  const started = useRef<number | null>(null);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    started.current = animate ? null : -1;
    invalidate();
  }, [animate, invalidate]);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g || started.current === -1) return;
    if (started.current === null) started.current = clock.elapsedTime;
    const t = (clock.elapsedTime - started.current) / PULSE_S;
    if (t >= 1) {
      g.scale.setScalar(1);
      g.position.y = y;
      started.current = -1;
      return;
    }
    // Dois saltos que se apagam.
    const k = Math.sin(t * Math.PI * 4) * (1 - t);
    g.scale.setScalar(1 + 0.25 * Math.abs(k));
    g.position.y = y + 0.35 * Math.abs(k);
    invalidate();
  });

  return (
    <group ref={ref} position={[0, y, 0]}>
      <mesh geometry={CYLINDER} material={mat(COLORS.blue)} position={[0, 0.55, 0]} scale={[0.7, 0.18, 0.7]} />
      <mesh material={mat(COLORS.blue)} position={[0, 0, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.32, 0.9, 16]} />
      </mesh>
      <mesh geometry={CYLINDER} material={mat(COLORS.sky)} position={[0, 0.66, 0]} scale={[0.36, 0.06, 0.36]} />
    </group>
  );
}

function RoomBlock({
  room,
  highlighted,
  pin,
  hover,
  animatePin,
  onSelect,
  onHover,
  children,
}: {
  room: Room;
  highlighted: boolean;
  pin: boolean;
  hover: boolean;
  animatePin: boolean;
  /** null: a zona não é uma paragem (reunião, núcleo) e não se clica. */
  onSelect: ((id: RoomId) => void) | null;
  onHover: (id: RoomId, inside: boolean) => void;
  children?: ReactNode;
}) {
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(room.id);
  };

  const floor = highlighted ? COLORS.sky : hover ? "#CFE3F6" : room.floor;
  const handlers = onSelect
    ? {
        onClick: click,
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(room.id, true);
        },
        onPointerOut: () => onHover(room.id, false),
      }
    : {};

  return (
    <group position={[room.x, 0, room.z]} {...handlers}>
      <Block p={[0, 0.04, 0]} s={[room.w, 0.08, room.d]} color={floor} />
      {children}
      {highlighted && pin && <NextPin animate={animatePin} />}
    </group>
  );
}

/** Lá fora: a rua pedonal a oeste (com a porta principal), a avenida e o rio a sul. */
function Surroundings() {
  const laneX = wx(-1.5);
  const southZ = wz(PLAN.depth);
  return (
    <>
      {/* Base da maqueta */}
      <Block p={[wx(7.3), -0.2, wz(14.2)]} s={[PLAN.width + 4.6, 0.4, PLAN.depth + 3.6]} color={COLORS.base} />
      {/* Rua pedonal, ao longo da fachada oeste */}
      <Block p={[laneX, 0.02, wz(14)]} s={[2, 0.04, PLAN.depth + 1.6]} color="#CBD5E1" />
      {/* Da rua até à porta principal */}
      <Block p={[wx(-0.25), 0.03, wz(25.1)]} s={[0.5, 0.06, 1.3]} color={COLORS.corridor} />
      {/* Avenida junto ao rio e o rio */}
      <Block p={[wx(7.3), 0.02, southZ + 0.85]} s={[PLAN.width + 4.6, 0.04, 1.3]} color="#DCE8F5" />
      <Block p={[wx(7.3), -0.06, southZ + 2.4]} s={[PLAN.width + 8, 0.04, 1.8]} color={COLORS.blue} />
    </>
  );
}

const isLit = (sides: readonly Area[], lit: (r: RoomId) => boolean) => sides.some((a) => a !== "corridor" && a !== "outside" && lit(a));

export function CampusModel({
  highlight,
  focus,
  pin,
  animate,
  onSelectStop,
  furniture,
}: {
  highlight: RoomId | null;
  /** A sala onde se está (null na vista geral): o resto apaga-se. */
  focus: RoomId | null;
  /** Pino por cima da sala acesa (só no mapa, onde marca a seguinte). */
  pin: boolean;
  animate: boolean;
  onSelectStop: (index: number) => void;
  furniture?: Partial<Record<RoomId, ReactNode>>;
}) {
  // Um só estado de hover para a planta toda: com um por sala, passar direto de uma sala para
  // outra corria as limpezas fora de ordem e o cursor ficava sem a mãozinha.
  const [hovered, setHovered] = useState<RoomId | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  // Ao sair, só limpa se ainda for esta a sala com hover (a seguinte pode já ter entrado).
  const onHover = useCallback((id: RoomId, inside: boolean) => setHovered((cur) => (inside ? id : cur === id ? null : cur)), []);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    invalidate();
  }, [hovered, invalidate]);
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  // O rato por cima de uma sala apagada acende-a: mostra que também se pode ir para lá.
  const lit = (r: RoomId) => focus === null || focus === r || hovered === r;

  return (
    <group>
      <Dim.Provider value={focus !== null}>
        <Surroundings />
        {/* Chão do corredor */}
        <Block p={[CORRIDOR.x, 0.03, 0]} s={[CORRIDOR.w, 0.06, PLAN.depth]} color={COLORS.corridor} />
      </Dim.Provider>

      {/* Cada troço de parede acende-se com a sala de um dos lados. */}
      {WALLS.map((wall, i) => (
        <Dim.Provider key={i} value={!isLit(wall.sides, lit)}>
          <Wall wall={wall} />
        </Dim.Provider>
      ))}

      {ROOMS.map((room) => {
        const index = stopOfRoom(room.id);
        return (
          <Dim.Provider key={room.id} value={!lit(room.id)}>
            <RoomBlock
              room={room}
              highlighted={highlight === room.id}
              pin={pin}
              hover={hovered === room.id}
              animatePin={animate}
              onSelect={index >= 0 ? () => onSelectStop(index) : null}
              onHover={onHover}
            >
              {furniture?.[room.id]}
            </RoomBlock>
          </Dim.Provider>
        );
      })}

      {/* O terraço não se vê no mapa: quando é o seguinte, o pino fica por cima das escadas. */}
      {highlight === "rooftop" && pin && (
        <group position={[STAIRS_PIN[0], 0, STAIRS_PIN[1]]}>
          <NextPin animate={animate} y={2.8} />
        </group>
      )}
    </group>
  );
}
