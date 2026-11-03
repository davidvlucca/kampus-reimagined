import { TOUR_STOPS } from "@kampus/shared";

// Planta do campus em metros. x cresce para este, z para sul (a câmara olha de sul para norte).
// "Volta ao corredor": três salas em cima, três em baixo e um corredor ao meio. A ordem da
// visita dá uma volta no sentido dos ponteiros, sempre para a sala ao lado:
//   Web Dev  | UX/UI  | Data
//   ──────── corredor ────────
//   Entrance | Lounge | Kitchen      (porta para a rua a sul, na Entrance)

export type RoomId = "entrance" | "web-dev" | "ux-ui" | "data" | "kitchen" | "lounge";

export interface Room {
  id: RoomId;
  /** Centro da sala no chão. */
  x: number;
  z: number;
  /** Lado do corredor onde fica a porta interior. */
  corridorSide: "north" | "south";
  floor: string;
  /** Etiqueta no mapa: o nome da paragem, sem o "room" (cabe no telemóvel deitado). */
  label: string;
}

export const ROOM_W = 6;
export const ROOM_D = 5;
export const CORRIDOR_D = 2;
export const WALL_H = 1.1;
export const WALL_T = 0.16;
export const DOOR_W = 1.4;

const COL = ROOM_W + WALL_T;
const ROW = CORRIDOR_D / 2 + ROOM_D / 2;

// O mesmo nome que a paragem tem no topo e no diálogo ("Data Analytics room" → "Data Analytics").
const labelOf = (id: RoomId) => TOUR_STOPS.find((s) => s.id === id)!.name.replace(/ room$/, "");

export const ROOMS: readonly Room[] = [
  { id: "web-dev", x: -COL, z: -ROW, corridorSide: "south", floor: "#DCE8F5", label: labelOf("web-dev") },
  { id: "ux-ui", x: 0, z: -ROW, corridorSide: "south", floor: "#E8F0FA", label: labelOf("ux-ui") },
  { id: "data", x: COL, z: -ROW, corridorSide: "south", floor: "#DCE8F5", label: labelOf("data") },
  { id: "entrance", x: -COL, z: ROW, corridorSide: "north", floor: "#F1F5FB", label: labelOf("entrance") },
  { id: "lounge", x: 0, z: ROW, corridorSide: "north", floor: "#E8F0FA", label: labelOf("lounge") },
  { id: "kitchen", x: COL, z: ROW, corridorSide: "north", floor: "#EEF3F9", label: labelOf("kitchen") },
];

/** Caixa de toda a planta (salas e corredor), para enquadrar a vista geral. */
export const PLAN = {
  width: 3 * ROOM_W + 2 * WALL_T,
  depth: 2 * ROOM_D + CORRIDOR_D,
};

/** A sala de cada paragem. A despedida (última paragem) é na vista geral: null. */
export const ROOM_FOR_STOP: Readonly<Record<string, RoomId | null>> = {
  entrance: "entrance",
  "web-dev": "web-dev",
  "ux-ui": "ux-ui",
  data: "data",
  kitchen: "kitchen",
  lounge: "lounge",
  farewell: null,
};

export function roomOfStop(index: number): RoomId | null {
  const stop = TOUR_STOPS[index];
  return stop ? (ROOM_FOR_STOP[stop.id] ?? null) : null;
}

/** A primeira paragem que acontece numa sala (clicar na sala leva a essa paragem). */
export function stopOfRoom(room: RoomId): number {
  return TOUR_STOPS.findIndex((s) => ROOM_FOR_STOP[s.id] === room);
}

/**
 * A sala que fica acesa como "a seguinte". Na despedida não há sala seguinte; a paragem da
 * despedida acende a Entrance, onde a visita acaba.
 */
export function highlightRoom(nextIndex: number | null): RoomId | null {
  if (nextIndex === null) return null;
  const stop = TOUR_STOPS[nextIndex];
  if (!stop) return null;
  return ROOM_FOR_STOP[stop.id] ?? "entrance";
}

export function roomById(id: RoomId): Room {
  return ROOMS.find((r) => r.id === id)!;
}
