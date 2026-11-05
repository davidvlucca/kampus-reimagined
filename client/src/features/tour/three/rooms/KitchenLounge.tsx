import { Block, Cylinder, Shadow } from "../CampusModel.tsx";
import { COLORS } from "../materials.ts";
import { AtPlan, Boxes, CORAL, DARK, F, LEAF, LIGHT, Plant, RoundTable, SLATE, STEEL, WallPanel, WOOD, type Box } from "./parts.tsx";

// Cozinha e lounge (67 m²), em coordenadas da planta: x 9,5–17, y 19–28. Bancada, café e
// frigorífico na parede este; mesa redonda ao centro; matraquilhos a noroeste e o sofá em L a
// sudeste. As portas do núcleo (a norte) e do corredor (a oeste) ficam livres.

/** Matraquilhos ao comprido em x: caixa, campo verde, varões de lado a lado e bonecos. */
function Foosball({ x, z }: { x: number; z: number }) {
  const rodY = F + 0.94;
  // Varão: posição em x e os bonecos (z relativo) de cada equipa.
  const rods: { dx: number; players: number[]; color: string }[] = [
    { dx: -0.39, players: [0], color: CORAL },
    { dx: -0.13, players: [-0.15, 0.15], color: COLORS.blue },
    { dx: 0.13, players: [-0.15, 0.15], color: CORAL },
    { dx: 0.39, players: [0], color: COLORS.blue },
  ];
  return (
    <>
      <Shadow x={x} z={z} w={1.4} d={0.9} />
      <Block p={[x - 0.5, F + 0.345, z]} s={[0.1, 0.69, 0.6]} color={COLORS.indigo} />
      <Block p={[x + 0.5, F + 0.345, z]} s={[0.1, 0.69, 0.6]} color={COLORS.indigo} />
      <Block p={[x, F + 0.78, z]} s={[1.2, 0.18, 0.7]} color={COLORS.navy} />
      <Block p={[x, F + 0.875, z]} s={[1.04, 0.02, 0.56]} color={LEAF} />
      {rods.map((rod) => (
        <group key={rod.dx}>
          <Block p={[x + rod.dx, rodY, z]} s={[0.025, 0.025, 1.1]} color={STEEL} />
          {rod.players.map((pz) => (
            <Block key={pz} p={[x + rod.dx, rodY - 0.02, z + pz]} s={[0.05, 0.11, 0.05]} color={rod.color} />
          ))}
        </group>
      ))}
    </>
  );
}

// Cadeiras à volta da mesa redonda (14,4; 21,6).
const CHAIRS: Box[] = [
  [[13.4, F + 0.225, 21.6], [0.4, 0.45, 0.4]],
  [[15.4, F + 0.225, 21.6], [0.4, 0.45, 0.4]],
  [[14.4, F + 0.225, 20.6], [0.4, 0.45, 0.4]],
  [[14.4, F + 0.225, 22.6], [0.4, 0.45, 0.4]],
];
// Sofá coral em L: assentos e encostos (encostados à parede este e à fachada sul).
const SOFA: Box[] = [
  [[16.5, F + 0.21, 26.7], [0.7, 0.42, 2.05]],
  [[16.85, F + 0.42, 26.7], [0.2, 0.84, 2.05]],
  [[15.0, F + 0.21, 27.4], [2.05, 0.42, 0.7]],
  [[15.0, F + 0.42, 27.75], [2.05, 0.84, 0.2]],
];

export function KitchenLoungeRoom() {
  return (
    <AtPlan room="kitchen">
      {/* Bancada ao longo da parede este, com café, micro-ondas e lava-loiça */}
      <Shadow x={16.5} z={21.55} w={0.9} d={4.7} />
      <Block p={[16.55, F + 0.43, 21.55]} s={[0.66, 0.86, 4.5]} color={COLORS.blue} />
      <Block p={[16.53, F + 0.88, 21.55]} s={[0.7, 0.04, 4.55]} color={LIGHT} />
      <Block p={[16.6, F + 1.1, 19.9]} s={[0.4, 0.4, 0.5]} color={DARK} />
      <Cylinder p={[16.3, F + 0.98, 20.35]} r={0.07} h={0.16} color={COLORS.sky} />
      <Block p={[16.62, F + 1.04, 21.35]} s={[0.42, 0.28, 0.6]} color={COLORS.surface} />
      <Block p={[16.5, F + 0.9, 22.9]} s={[0.42, 0.02, 0.6]} color={STEEL} />
      {/* Quadro com os dados do Wi-Fi, ao lado do frigorífico */}
      <WallPanel x={16.92} z={23.55} w={0.6} h={0.45} y={1.75} face="west" color={COLORS.navy}>
        <Block p={[0, -0.16, 0.01]} s={[0.4, 0.06, 0.02]} color={COLORS.sky} />
        <Block p={[-0.05, -0.29, 0.01]} s={[0.3, 0.06, 0.02]} color={COLORS.sky} />
      </WallPanel>
      {/* Frigorífico alto */}
      <Block p={[16.45, F + 0.9, 24.5]} s={[0.9, 1.8, 1.1]} color="#CBD5E1" />
      <Block p={[15.98, F + 1.15, 24.2]} s={[0.04, 0.5, 0.04]} color={SLATE} />

      {/* Mesa redonda de madeira com quatro cadeiras */}
      <RoundTable x={14.4} z={21.6} r={0.7} />
      <Boxes items={CHAIRS} color={COLORS.blue} />

      <Foosball x={10.8} z={20.45} />

      {/* Lounge: tapete, sofá em L e mesa baixa */}
      <Block p={[14.6, F + 0.005, 26.1]} s={[2.6, 0.01, 2.0]} color={COLORS.sky} />
      <Shadow x={15.6} z={26.9} w={2.8} d={2.4} />
      <Boxes items={SOFA} color={CORAL} />
      <Block p={[15.15, F + 0.19, 26.2]} s={[0.9, 0.38, 0.6]} color={WOOD} />

      <Plant x={10} z={25.2} />
      <Plant x={10.1} z={27.4} size={1.2} />
    </AtPlan>
  );
}
