import { Block, Shadow } from "../CampusModel.tsx";
import { useMat } from "../dim.ts";
import { BOX, COLORS, CYLINDER } from "../materials.ts";
import { AtPlan, Boxes, CORAL, DESK_TOP, F, RoundTable, STEEL, WallPanel, type Box } from "./parts.tsx";

// Data (45 m², 3 ecrãs), em coordenadas da planta: x 9,5–17, y 0–6. Três ecrãs na parede norte
// (barras, linha e donut), a mesa comprida com monitores por baixo e uma mesa redonda a sudeste.

/** Segmento fino no plano do ecrã, de a a b (x, y a partir do topo). */
function Segment({ a, b }: { a: [number, number]; b: [number, number] }) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return (
    <mesh
      geometry={BOX}
      material={useMat(COLORS.sky)}
      position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.02]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
      scale={[Math.hypot(dx, dy) + 0.04, 0.05, 0.02]}
    />
  );
}

/** Disco no plano do ecrã. */
function Disc({ x, y, r, color, z = 0.02 }: { x: number; y: number; r: number; color: string; z?: number }) {
  return <mesh geometry={CYLINDER} material={useMat(color)} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]} scale={[r * 2, 0.02, r * 2]} />;
}

const BARS = [0.25, 0.42, 0.32, 0.52, 0.6];
const LINE: [number, number][] = [
  [-0.65, -0.75],
  [-0.25, -0.5],
  [0.15, -0.62],
  [0.6, -0.25],
];

const SEATS = [10.6, 11.75, 12.9, 14.05, 15.2, 16.3];
const MONITORS: Box[] = SEATS.map((x): Box => [[x, DESK_TOP + 0.24, 1.62], [0.5, 0.3, 0.04]]);
const CHAIRS: Box[] = SEATS.map((x): Box => [[x, F + 0.225, 2.35], [0.4, 0.45, 0.4]]);
const BACKS: Box[] = SEATS.map((x): Box => [[x, F + 0.62, 2.53], [0.4, 0.34, 0.05]]);
const ROUND_CHAIRS: Box[] = [15.0, 16.6].map((x): Box => [[x, F + 0.225, 5.2], [0.4, 0.45, 0.4]]);
const LEGS: Box[] = [10.1, 16.6].map((x): Box => [[x, F + 0.36, 1.75], [0.06, 0.72, 0.44]]);

export function DataRoom() {
  const SCREEN = { w: 1.9, h: 1.0, y: 1.75, z: 0.12 };
  return (
    <AtPlan room="data">
      {/* Ecrã 1: gráfico de barras */}
      <WallPanel x={10.95} z={SCREEN.z} w={SCREEN.w} h={SCREEN.h} y={SCREEN.y} face="south" color={COLORS.navy}>
        {BARS.map((h, i) => (
          <Block key={i} p={[-0.6 + i * 0.3, -0.9 + h / 2, 0.02]} s={[0.2, h, 0.02]} color={i === BARS.length - 1 ? COLORS.sky : COLORS.blue} />
        ))}
      </WallPanel>
      {/* Ecrã 2: gráfico de linha */}
      <WallPanel x={13.35} z={SCREEN.z} w={SCREEN.w} h={SCREEN.h} y={SCREEN.y} face="south" color={COLORS.navy}>
        {LINE.slice(1).map((b, i) => (
          <Segment key={i} a={LINE[i]!} b={b} />
        ))}
      </WallPanel>
      {/* Ecrã 3: donut e uma legenda curta */}
      <WallPanel x={15.75} z={SCREEN.z} w={SCREEN.w} h={SCREEN.h} y={SCREEN.y} face="south" color={COLORS.navy}>
        <Disc x={-0.35} y={-0.5} r={0.3} color={COLORS.sky} />
        <Disc x={-0.35} y={-0.5} r={0.15} color={COLORS.navy} z={0.035} />
        <Block p={[0.35, -0.4, 0.02]} s={[0.5, 0.07, 0.02]} color={COLORS.sky} />
        <Block p={[0.3, -0.58, 0.02]} s={[0.4, 0.07, 0.02]} color={CORAL} />
      </WallPanel>

      {/* Mesa comprida com monitores e cadeiras */}
      <Shadow x={13.35} z={1.9} w={7} d={1.2} />
      <Block p={[13.35, DESK_TOP - 0.03, 1.75]} s={[6.7, 0.06, 0.5]} color={COLORS.surface} />
      <Boxes items={LEGS} color={STEEL} />
      <Boxes items={MONITORS} color={COLORS.indigo} />
      <Boxes items={CHAIRS} color={COLORS.blue} />
      <Boxes items={BACKS} color={COLORS.indigo} />

      {/* Mesa redonda para conversas, com duas cadeiras */}
      <RoundTable x={15.8} z={4.9} r={0.55} top={COLORS.surface} />
      <Boxes items={ROUND_CHAIRS} color={COLORS.blue} />
    </AtPlan>
  );
}
