import { Block, Shadow } from "../CampusModel.tsx";
import { COLORS } from "../materials.ts";
import { AtPlan, Boxes, Cylinders, DESK_TOP, F, Lid, Plant, STEEL, type Box } from "./parts.tsx";

// Open space (67 m², 3 cabines), em coordenadas da planta: x 9,5–17, y 6–15. Duas mesas
// compridas de estudo com bancos dos dois lados e, na parede este, três cabines de vidro.

const TABLES = [10.7, 14.2];
const TOPS: Box[] = TABLES.map((x): Box => [[x, DESK_TOP - 0.03, 9.7], [0.8, 0.06, 5.4]]);
const LEGS: Box[] = TABLES.flatMap((x) => [7.2, 12.2].map((z): Box => [[x, F + 0.36, z], [0.7, 0.72, 0.06]]));
const STOOLS = [9.95, 11.45, 13.45, 14.95].flatMap((x) => [7.8, 9, 10.2, 11.4].map((z) => [x, F + 0.225, z, 0.18, 0.45] as const));

// Cabines: vidro azul-céu baixo (deixa ver o banco lá dentro) e uma faixa azul a fazer de porta.
const BOOTHS = [6.4, 8.5, 10.6];
const GLASS: Box[] = BOOTHS.flatMap((y) => [
  [[16.15, F + 0.5, y + 0.03], [1.5, 1.0, 0.06]] as Box,
  [[16.15, F + 0.5, y + 1.77], [1.5, 1.0, 0.06]] as Box,
  [[15.43, F + 0.5, y + 0.9], [0.06, 1.0, 1.8]] as Box,
]);
const FRAMES: Box[] = BOOTHS.map((y): Box => [[16.15, F + 1.02, y + 0.9], [1.5, 0.05, 1.8]]);
const SEATS: Box[] = BOOTHS.map((y): Box => [[16.55, F + 0.22, y + 0.9], [0.4, 0.44, 0.9]]);

export function OpenSpaceRoom() {
  return (
    <AtPlan room="open-space">
      <Shadow x={10.7} z={9.7} w={1.1} d={5.7} />
      <Shadow x={14.2} z={9.7} w={1.1} d={5.7} />
      <Boxes items={TOPS} color={COLORS.surface} />
      <Boxes items={LEGS} color={STEEL} />
      <Cylinders items={STOOLS} color={COLORS.blue} />
      <Lid x={10.85} z={8.4} rotY={Math.PI / 2} />
      <Lid x={10.55} z={10.6} rotY={-Math.PI / 2} />
      <Lid x={14.05} z={9.2} rotY={-Math.PI / 2} />

      {BOOTHS.map((y) => (
        <Block key={y} p={[16.15, F + 0.01, y + 0.9]} s={[1.5, 0.02, 1.8]} color={COLORS.sky} />
      ))}
      <Boxes items={GLASS} color="#CFEFFC" />
      <Boxes items={FRAMES} color={COLORS.blue} />
      <Boxes items={SEATS} color={COLORS.navy} />

      <Plant x={16.3} z={13.4} />
      <Plant x={15.3} z={14.3} size={0.8} />
    </AtPlan>
  );
}
