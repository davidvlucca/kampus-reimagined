import { Block, Shadow } from "../CampusModel.tsx";
import { COLORS } from "../materials.ts";
import { AtPlan, Boxes, CORAL, Cylinders, DESK_TOP, F, LEAF, Lid, Plant, STEEL, WallPanel, WOOD, YELLOW, type Box } from "./parts.tsx";

// UX/UI (52 m²), em coordenadas da planta: x 0–7,5, y 0–7. Parede de post-its a oeste,
// quadro com wireframes a norte e a mesa grande partilhada ao centro, com bancos à volta.

const GREY = "#CBD5E1";

// Wireframe no quadro: centro (x, y a partir do topo) e tamanho de cada caixa.
const WIREFRAME: [number, number, number, number, string][] = [
  [0, -0.14, 2.3, 0.12, COLORS.blue],
  [-0.65, -0.52, 0.85, 0.5, COLORS.sky],
  [0.55, -0.36, 0.95, 0.08, GREY],
  [0.45, -0.52, 0.75, 0.08, GREY],
  [0.5, -0.68, 0.85, 0.08, GREY],
  [-0.65, -0.9, 0.85, 0.1, GREY],
];

// Post-its: 2 colunas × 6 linhas, como na planta.
const NOTE_COLORS = [YELLOW, CORAL, CORAL, LEAF, LEAF, COLORS.sky, COLORS.sky, YELLOW, YELLOW, CORAL, CORAL, LEAF];

const TABLE: [number, number, number, number] = [2.4, 2.8, 4, 1.6];
const tx = TABLE[0] + TABLE[2] / 2;
const tz = TABLE[1] + TABLE[3] / 2;

const LEGS: Box[] = [-1.8, 1.8].map((dx): Box => [[tx + dx, F + 0.36, tz], [0.08, 0.72, 1.3]]);
const STOOLS = [
  ...[2.9, 3.9, 4.9, 5.9].flatMap((x) => [
    [x, F + 0.225, 2.45, 0.19, 0.45] as const,
    [x, F + 0.225, 4.75, 0.19, 0.45] as const,
  ]),
  [2.05, F + 0.225, 3.6, 0.19, 0.45] as const,
  [6.75, F + 0.225, 3.6, 0.19, 0.45] as const,
];

export function UxUiRoom() {
  return (
    <AtPlan room="ux-ui">
      {/* Quadro branco com wireframes, na parede norte */}
      <WallPanel x={4.4} z={0.12} w={2.7} h={1.1} y={1.7} face="south" color={GREY}>
        <Block p={[0, -0.55, 0]} s={[2.56, 0.98, 0.02]} color={COLORS.surface} />
        {WIREFRAME.map(([x, y, w, h, color], i) => (
          <Block key={i} p={[x, y, 0.02]} s={[w, h, 0.02]} color={color} />
        ))}
      </WallPanel>

      {/* Parede de post-its a oeste */}
      <WallPanel x={0.12} z={3.15} w={3.1} h={1.0} y={1.45} face="east" color="#FFFFFF">
        {NOTE_COLORS.map((color, i) => (
          <Block key={i} p={[-1.25 + Math.floor(i / 2) * 0.5, -0.3 - (i % 2) * 0.42, 0.01]} s={[0.3, 0.3, 0.02]} color={color} />
        ))}
      </WallPanel>

      {/* Mesa grande de madeira com portáteis e esboços */}
      <Shadow x={tx} z={tz} w={TABLE[2] + 0.3} d={TABLE[3] + 0.3} />
      <Block p={[tx, DESK_TOP - 0.03, tz]} s={[TABLE[2], 0.06, TABLE[3]]} color={WOOD} />
      <Boxes items={LEGS} color={STEEL} />
      <Block p={[3.35, DESK_TOP + 0.01, 3.42]} s={[0.7, 0.02, 0.45]} color="#FFFFFF" />
      <Block p={[4.85, DESK_TOP + 0.01, 3.7]} s={[0.55, 0.02, 0.4]} color={YELLOW} />
      <Lid x={5.7} z={3.25} />
      <Lid x={3.0} z={4.1} rotY={Math.PI} />
      <Cylinders items={STOOLS} color={COLORS.blue} />

      <Plant x={6.9} z={0.6} />
    </AtPlan>
  );
}
