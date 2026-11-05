import { Block, Shadow } from "../CampusModel.tsx";
import { COLORS } from "../materials.ts";
import { AtPlan, Boxes, CORAL, DESK_TOP, F, LEAF, Plant, STEEL, WallPanel, YELLOW, type Box } from "./parts.tsx";

// Web Dev (71 m², 28 mesas), em coordenadas da planta: x 0–7,5, y 7–16,5. Ecrã de código na
// parede norte, quadro com o plano da semana a sul e as mesas em três blocos, como na planta.
// As 28 mesas são instâncias (uma chamada à GPU por cor), não 140 peças.

// Canto noroeste de cada mesa (0,95 × 0,42 m); o aluno senta-se a sul, virado para o ecrã.
const DESKS: [number, number][] = [
  ...[8.75, 9.8, 10.85].flatMap((y) => [2.65, 3.8, 4.95, 6.1].map((x): [number, number] => [x, y])),
  ...[12.9, 13.95].flatMap((y) => [0.45, 1.6, 2.75, 3.9, 5.05, 6.2].map((x): [number, number] => [x, y])),
  ...[1.6, 2.75, 3.9, 5.05].map((x): [number, number] => [x, 15]),
];

const center = ([x, y]: [number, number]) => [x + 0.475, y + 0.21] as const;

const TOPS: Box[] = DESKS.map((d) => {
  const [x, z] = center(d);
  return [[x, DESK_TOP - 0.03, z], [0.95, 0.06, 0.42]];
});
const LEGS: Box[] = DESKS.flatMap((d) => {
  const [x, z] = center(d);
  return [-0.42, 0.42].map((dx): Box => [[x + dx, F + 0.36, z], [0.05, 0.72, 0.36]]);
});
const LIDS: Box[] = DESKS.map((d) => {
  const [x, z] = center(d);
  return [[x, DESK_TOP + 0.12, z - 0.12], [0.34, 0.22, 0.03]];
});
const SEATS: Box[] = DESKS.map((d) => {
  const [x, z] = center(d);
  return [[x, F + 0.225, z + 0.5], [0.4, 0.45, 0.4]];
});
const BACKS: Box[] = DESKS.map((d) => {
  const [x, z] = center(d);
  return [[x, F + 0.62, z + 0.68], [0.4, 0.34, 0.05]];
});

// Linhas de "código": recuo, largura e cor de cada barra.
const CODE: [number, number, string][] = [
  [0, 1.4, COLORS.sky],
  [0.3, 1.0, CORAL],
  [0.6, 1.6, LEAF],
  [0.6, 0.8, COLORS.sky],
  [0.3, 1.2, YELLOW],
  [0, 0.7, COLORS.sky],
];

// Plano da semana: cinco colunas (dias) com blocos de cores.
const WEEK: [number, number, string][] = [
  [0, 0.3, COLORS.blue],
  [0, 0.55, LEAF],
  [1, 0.3, COLORS.blue],
  [1, 0.55, YELLOW],
  [2, 0.3, COLORS.blue],
  [2, 0.55, CORAL],
  [3, 0.3, COLORS.blue],
  [3, 0.55, LEAF],
  [4, 0.42, COLORS.indigo],
];

export function WebDevRoom() {
  return (
    <AtPlan room="web-dev">
      {/* Ecrã grande na parede norte, virado para as mesas */}
      <WallPanel x={4.9} z={7.12} w={3.4} h={1.25} y={1.7} face="south" color={COLORS.indigo}>
        <Block p={[0, -0.62, 0]} s={[3.2, 1.08, 0.02]} color={COLORS.navy} />
        {CODE.map(([indent, w, color], i) => (
          <Block key={i} p={[-1.4 + indent + w / 2, -0.24 - i * 0.15, 0.02]} s={[w, 0.08, 0.02]} color={color} />
        ))}
      </WallPanel>

      {/* Quadro branco com o plano da semana, a sul */}
      <WallPanel x={4.3} z={16.38} w={4.2} h={1.0} y={1.55} face="north" color={COLORS.surface}>
        {WEEK.map(([day, y, color], i) => (
          <Block key={i} p={[-1.6 + day * 0.8, -y, 0.01]} s={[0.6, 0.18, 0.02]} color={color} />
        ))}
      </WallPanel>

      <Shadow x={4.1} z={9.95} w={4.8} d={2.6} />
      <Shadow x={3.85} z={14.15} w={6.9} d={1.6} />
      <Boxes items={TOPS} color={COLORS.surface} />
      <Boxes items={LEGS} color={STEEL} />
      <Boxes items={LIDS} color={COLORS.navy} />
      <Boxes items={SEATS} color={COLORS.blue} />
      <Boxes items={BACKS} color={COLORS.indigo} />

      <Plant x={0.55} z={9.3} />
    </AtPlan>
  );
}
