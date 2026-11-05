import { TOUR_STOPS } from "@kampus/shared";

// Planta do campus, a aprovada para a visita: um edifício de 17 × 28 m, com a porta principal
// na rua pedonal (oeste) e o rio a sul. Corredor de 2 m de norte a sul; à esquerda dele, de norte
// para sul, UX/UI, Web Dev, sala de reuniões e Entrance; à direita, Data, open space, núcleo
// (escadas, elevador, WC) e cozinha com lounge. Por cima, o terraço (rooftop).
//
// As medidas vêm em coordenadas da planta (px para este a partir da fachada oeste, py para sul a
// partir da fachada norte, em metros) e passam aqui para o mundo 3D, com o centro do edifício na
// origem: x cresce para este, z para sul.

export type RoomId = "entrance" | "web-dev" | "ux-ui" | "data" | "open-space" | "kitchen" | "meeting" | "core" | "rooftop";
/** Zonas que não são salas mas contam para as ligações (portas e escadas). */
export type Area = RoomId | "corridor" | "outside";

export const SHELL_W = 17;
export const SHELL_D = 28;
export const WALL_H = 1.1;
export const WALL_T = 0.16;
/**
 * Altura do chão do terraço. A laje assenta nas paredes cortadas e é grossa o bastante para tapar
 * o que passa delas lá em baixo (ecrãs de parede, frigorífico).
 */
export const ROOF_Y = 2.0;

/** Da planta para o mundo. */
export const wx = (px: number) => px - SHELL_W / 2;
export const wz = (py: number) => py - SHELL_D / 2;

export interface Room {
  id: RoomId;
  /** Centro da sala no chão e tamanho, em metros. */
  x: number;
  z: number;
  w: number;
  d: number;
  /** Canto noroeste na planta (os móveis de cada sala usam estas coordenadas). */
  px: number;
  py: number;
  floor: string;
  /** Etiqueta no mapa (o início do nome da paragem) ou null nas zonas que não são paragens. */
  label: string | null;
}

// O início do nome da paragem, que cabe no telemóvel deitado ("Web Dev classroom" → "Web Dev").
const labelOf = (id: string) =>
  TOUR_STOPS.find((s) => s.id === id)!.name.replace(/ (classroom|and reception|and phone booths)$/, "");

function room(id: RoomId, px: number, py: number, px1: number, py1: number, floor: string, stop: string | null): Room {
  const w = px1 - px;
  const d = py1 - py;
  return { id, x: wx(px + w / 2), z: wz(py + d / 2), w, d, px, py, floor, label: stop ? labelOf(stop) : null };
}

/** O rés-do-chão. A reunião e o núcleo não são paragens: não se clicam nem têm etiqueta. */
export const ROOMS: readonly Room[] = [
  room("ux-ui", 0, 0, 7.5, 7, "#E8F0FA", "ux-ui"),
  room("web-dev", 0, 7, 7.5, 16.5, "#DCE8F5", "web-dev"),
  room("meeting", 0, 16.5, 7.5, 20, "#EEF3F9", null),
  room("entrance", 0, 20, 7.5, 28, "#F1F5FB", "entrance"),
  room("data", 9.5, 0, 17, 6, "#DCE8F5", "data"),
  room("open-space", 9.5, 6, 17, 15, "#E8F0FA", "open-space"),
  room("core", 9.5, 15, 17, 19, "#E2E8F0", null),
  room("kitchen", 9.5, 19, 17, 28, "#EEF3F9", "kitchen"),
];

/** O terraço: a câmara enquadra a metade sul (bancos, bar e o rio), onde a paragem acontece. */
export const ROOFTOP: Room = room("rooftop", 0, 13, 17, 28, "#EFE6DA", "rooftop");

export const CORRIDOR = { x: wx(8.5), w: 2 };

/** Caixa do edifício, para enquadrar a vista geral. */
export const PLAN = { width: SHELL_W, depth: SHELL_D };

/** Uma linha de parede na planta: ao longo de px (alongX) ou de py, de `from` a `to`, em `at`. */
export interface WallLine {
  alongX: boolean;
  at: number;
  from: number;
  to: number;
}

/** Uma abertura numa parede e as duas zonas que liga. */
export interface Door extends WallLine {
  a: Area;
  b: Area;
}

const line = (alongX: boolean, at: number, from: number, to: number): WallLine => ({ alongX, at, from, to });
const door = (a: Area, b: Area, alongX: boolean, at: number, from: number, to: number): Door => ({ a, b, alongX, at, from, to });

const WALL_LINES: readonly WallLine[] = [
  // Fachadas
  line(true, 0, 0, SHELL_W),
  line(true, SHELL_D, 0, SHELL_W),
  line(false, 0, 0, SHELL_D),
  line(false, SHELL_W, 0, SHELL_D),
  // Corredor
  line(false, 7.5, 0, SHELL_D),
  line(false, 9.5, 0, SHELL_D),
  // Divisórias a oeste e a este do corredor
  line(true, 7, 0, 7.5),
  line(true, 16.5, 0, 7.5),
  line(true, 20, 0, 7.5),
  line(true, 6, 9.5, SHELL_W),
  line(true, 15, 9.5, SHELL_W),
  line(true, 19, 9.5, SHELL_W),
  // O WC dentro do núcleo
  line(false, 14.6, 15, 19),
];

export const DOORS: readonly Door[] = [
  door("outside", "entrance", false, 0, 24.45, 25.75),
  door("corridor", "ux-ui", false, 7.5, 4.7, 5.9),
  door("corridor", "web-dev", false, 7.5, 11.4, 12.6),
  door("corridor", "meeting", false, 7.5, 17.65, 18.85),
  door("corridor", "entrance", false, 7.5, 24.5, 25.7),
  door("corridor", "data", false, 9.5, 4.7, 5.9),
  door("corridor", "open-space", false, 9.5, 12.7, 13.9),
  door("corridor", "core", false, 9.5, 16.4, 17.6),
  door("corridor", "kitchen", false, 9.5, 22.4, 23.6),
  door("ux-ui", "web-dev", true, 7, 1, 2.2),
  door("data", "open-space", true, 6, 12, 13.2),
  door("core", "kitchen", true, 19, 11.4, 12.6),
  door("core", "kitchen", true, 19, 15.2, 16.4),
];

/** As escadas e o elevador do núcleo sobem ao terraço (não há parede: é uma ligação à parte). */
export const STAIRS: readonly [Area, Area] = ["core", "rooftop"];

/** Janelas na fachada sul, viradas para o rio: a parede baixa e um vidro azul-céu. */
export const WINDOWS: readonly WallLine[] = [line(true, SHELL_D, 1.2, 3.4), line(true, SHELL_D, 10.6, 12.8), line(true, SHELL_D, 13.6, 15.8)];

/** As zonas que se tocam numa porta ou nas escadas (para os testes e para saber o caminho). */
export function connections(): [Area, Area][] {
  return [...DOORS.map((d): [Area, Area] => [d.a, d.b]), [...STAIRS]];
}

/** A zona (sala, corredor ou rua) onde fica um ponto da planta. */
export function areaAt(px: number, py: number): Area {
  if (px < 0 || px > SHELL_W || py < 0 || py > SHELL_D) return "outside";
  if (px > 7.5 && px < 9.5) return "corridor";
  return ROOMS.find((r) => px > r.px && px < r.px + r.w && py > r.py && py < r.py + r.d)?.id ?? "outside";
}

/** Um troço de parede já cortado nas portas e janelas, no mundo, com as zonas dos dois lados. */
export interface WallPiece {
  x: number;
  z: number;
  length: number;
  alongX: boolean;
  /** Janela: só o parapeito, com um vidro por cima. */
  window: boolean;
  sides: [Area, Area];
}

function cut(l: WallLine, gaps: readonly WallLine[]): [number, number][] {
  const holes = gaps.filter((g) => g.alongX === l.alongX && g.at === l.at && g.from >= l.from && g.to <= l.to).sort((a, b) => a.from - b.from);
  const out: [number, number][] = [];
  let start = l.from;
  for (const h of holes) {
    if (h.from > start) out.push([start, h.from]);
    start = h.to;
  }
  if (l.to > start) out.push([start, l.to]);
  return out;
}

function piece(l: WallLine, from: number, to: number, window: boolean): WallPiece {
  const mid = (from + to) / 2;
  const [px, py] = l.alongX ? [mid, l.at] : [l.at, mid];
  const e = 0.2;
  const sides: [Area, Area] = l.alongX ? [areaAt(px, py - e), areaAt(px, py + e)] : [areaAt(px - e, py), areaAt(px + e, py)];
  // Nas pontas da linha (não nas portas) a parede passa meia espessura, para os cantos fecharem.
  const a = !window && from === l.from ? WALL_T / 2 : 0;
  const b = !window && to === l.to ? WALL_T / 2 : 0;
  const c = mid + (b - a) / 2;
  const [cx, cy] = l.alongX ? [c, l.at] : [l.at, c];
  return { x: wx(cx), z: wz(cy), length: to - from + a + b, alongX: l.alongX, window, sides };
}

export const WALLS: readonly WallPiece[] = [
  ...WALL_LINES.flatMap((l) => cut(l, [...DOORS, ...WINDOWS]).map(([a, b]) => piece(l, a, b, false))),
  ...WINDOWS.map((w) => piece(w, w.from, w.to, true)),
];

/** A sala de cada paragem. A despedida (última paragem) é na vista geral: null. */
export const ROOM_FOR_STOP: Readonly<Record<string, RoomId | null>> = {
  entrance: "entrance",
  "web-dev": "web-dev",
  "ux-ui": "ux-ui",
  data: "data",
  "open-space": "open-space",
  kitchen: "kitchen",
  rooftop: "rooftop",
  farewell: null,
};

export function roomOfStop(index: number): RoomId | null {
  const stop = TOUR_STOPS[index];
  return stop ? (ROOM_FOR_STOP[stop.id] ?? null) : null;
}

/** A primeira paragem que acontece numa sala (clicar na sala leva a essa paragem); -1 se nenhuma. */
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
  return id === "rooftop" ? ROOFTOP : ROOMS.find((r) => r.id === id)!;
}
