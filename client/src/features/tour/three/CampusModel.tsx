import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Dim, useMat } from "./dim.ts";
import type { Group } from "three";
import { CORRIDOR_D, DOOR_W, PLAN, ROOM_D, ROOM_W, ROOMS, stopOfRoom, WALL_H, WALL_T, type Room, type RoomId } from "./layout.ts";
import { BOX, COLORS, CYLINDER, mat, PLANE, SHADOW } from "./materials.ts";

const PULSE_S = 1.5;

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

/** Uma parede ao longo de x (dx=1) ou de z, com uma porta opcional ao centro. */
function Wall({ x, z, length, alongX, door = false }: { x: number; z: number; length: number; alongX: boolean; door?: boolean }) {
  const pieces: [number, number][] = door
    ? [
        [-(length + DOOR_W) / 4, (length - DOOR_W) / 2],
        [(length + DOOR_W) / 4, (length - DOOR_W) / 2],
      ]
    : [[0, length]];
  return (
    <>
      {pieces.map(([offset, len]) => {
        const px = alongX ? x + offset : x;
        const pz = alongX ? z : z + offset;
        const size: [number, number, number] = alongX ? [len, WALL_H, WALL_T] : [WALL_T, WALL_H, len];
        const cap: [number, number, number] = alongX ? [len, 0.06, WALL_T + 0.02] : [WALL_T + 0.02, 0.06, len];
        return (
          <group key={offset}>
            <Block p={[px, WALL_H / 2, pz]} s={size} color={COLORS.wall} />
            <Block p={[px, WALL_H + 0.03, pz]} s={cap} color={COLORS.wallCap} />
          </group>
        );
      })}
    </>
  );
}

/** A parede este é partilhada com a sala ao lado: só se apaga se nenhuma das duas for a atual. */
function RoomWalls({ room, eastDim }: { room: Room; eastDim: boolean }) {
  const north = room.z - ROOM_D / 2;
  const south = room.z + ROOM_D / 2;
  const west = room.x - ROOM_W / 2;
  const east = room.x + ROOM_W / 2;
  const isWestColumn = room.x < 0 && Math.abs(room.x) > 1;
  return (
    <>
      <Wall x={room.x} z={north} length={ROOM_W} alongX door={room.corridorSide === "north"} />
      {/* A Entrance tem também a porta da rua, a sul. */}
      <Wall x={room.x} z={south} length={ROOM_W} alongX door={room.corridorSide === "south" || room.id === "entrance"} />
      {isWestColumn && <Wall x={west} z={room.z} length={ROOM_D} alongX={false} />}
      <Dim.Provider value={eastDim}>
        <Wall x={east} z={room.z} length={ROOM_D} alongX={false} />
      </Dim.Provider>
    </>
  );
}

/** Pino por cima da sala seguinte, com um pulso curto quando muda. */
function NextPin({ animate }: { animate: boolean }) {
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
      g.position.y = 2.4;
      started.current = -1;
      return;
    }
    // Dois saltos que se apagam.
    const k = Math.sin(t * Math.PI * 4) * (1 - t);
    g.scale.setScalar(1 + 0.25 * Math.abs(k));
    g.position.y = 2.4 + 0.35 * Math.abs(k);
    invalidate();
  });

  return (
    <group ref={ref} position={[0, 2.4, 0]}>
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
  onSelect: (id: RoomId) => void;
  onHover: (id: RoomId, inside: boolean) => void;
  children?: ReactNode;
}) {
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(room.id);
  };

  const floor = highlighted ? COLORS.sky : hover ? "#CFE3F6" : room.floor;

  return (
    <group
      position={[room.x, 0, room.z]}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(room.id, true);
      }}
      onPointerOut={() => onHover(room.id, false)}
    >
      <Block p={[0, 0.04, 0]} s={[ROOM_W, 0.08, ROOM_D]} color={floor} />
      {highlighted && <Block p={[0, 0.005, 0]} s={[ROOM_W + 0.5, 0.01, ROOM_D + 0.5]} color={COLORS.sky} />}
      {children}
      {highlighted && pin && <NextPin animate={animatePin} />}
    </group>
  );
}

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
  const halfW = PLAN.width / 2;
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
  const dimmed = (r: RoomId) => focus !== null && focus !== r && hovered !== r;

  return (
    <group>
      <Dim.Provider value={focus !== null}>
        {/* Base da maqueta e corredor */}
        <Block p={[0, -0.2, 0]} s={[PLAN.width + 1.2, 0.4, PLAN.depth + 1.2]} color={COLORS.base} />
        <Block p={[0, 0.03, 0]} s={[PLAN.width, 0.06, CORRIDOR_D]} color={COLORS.corridor} />
        <Wall x={-halfW} z={0} length={CORRIDOR_D} alongX={false} />
        <Wall x={halfW} z={0} length={CORRIDOR_D} alongX={false} />
        {/* Caminho da rua até à porta da Entrance */}
        <Block p={[ROOMS.find((r) => r.id === "entrance")!.x, 0.02, PLAN.depth / 2 + 0.6]} s={[DOOR_W + 0.4, 0.04, 1.2]} color={COLORS.corridor} />
      </Dim.Provider>

      {ROOMS.map((room) => {
        const index = stopOfRoom(room.id);
        const east = ROOMS.find((o) => o.z === room.z && o.x > room.x && o.x - room.x < ROOM_W + 1);
        return (
          <Dim.Provider key={room.id} value={dimmed(room.id)}>
            <RoomWalls room={room} eastDim={dimmed(room.id) && (!east || dimmed(east.id))} />
            <RoomBlock
              room={room}
              highlighted={highlight === room.id}
              pin={pin}
              hover={hovered === room.id}
              animatePin={animate}
              onSelect={() => onSelectStop(index)}
              onHover={onHover}
            >
              {furniture?.[room.id]}
            </RoomBlock>
          </Dim.Provider>
        );
      })}
    </group>
  );
}
