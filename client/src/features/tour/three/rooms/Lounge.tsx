import { Block, Cylinder, Shadow } from "../CampusModel.tsx";
import { COLORS } from "../materials.ts";

// Móveis da sala "lounge". Coordenadas locais: origem no centro da sala, chão em y = 0.08.
// Sofá, tapete e candeeiro a oeste; matraquilhos a este; a porta do corredor (norte) fica livre.

const F = 0.08;
const CORAL = "#F28C6B";
const WOOD = "#D9B48F";
const STEEL = "#94A3B8";
const DARK = "#1E293B";
const LEAF = "#86EFAC";

function Plant({ x, z }: { x: number; z: number }) {
  return (
    <>
      <Cylinder p={[x, F + 0.17, z]} r={0.17} h={0.34} color={COLORS.indigo} />
      <Cylinder p={[x, F + 0.55, z]} r={0.3} h={0.42} color={LEAF} />
      <Cylinder p={[x, F + 0.91, z]} r={0.19} h={0.3} color={LEAF} />
    </>
  );
}

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

export function LoungeRoom() {
  return (
    <>
      {/* Tapete às riscas: rebordo índigo e centro azul-céu */}
      <Block p={[-1.1, F + 0.005, 0.4]} s={[1.7, 0.01, 2.2]} color={COLORS.indigo} />
      <Block p={[-1.1, F + 0.008, 0.4]} s={[1.5, 0.012, 2.0]} color={COLORS.sky} />

      {/* Sofá coral encostado à parede oeste: assento, encosto e dois braços */}
      <Shadow x={-2.45} z={0.4} w={1.1} d={2.2} />
      <Block p={[-2.35, F + 0.21, 0.4]} s={[0.7, 0.42, 1.7]} color={CORAL} />
      <Block p={[-2.81, F + 0.4, 0.4]} s={[0.22, 0.8, 1.7]} color={CORAL} />
      <Block p={[-2.46, F + 0.3, -0.525]} s={[0.92, 0.6, 0.15]} color={CORAL} />
      <Block p={[-2.46, F + 0.3, 1.325]} s={[0.92, 0.6, 0.15]} color={CORAL} />

      {/* Mesa baixa em cima do tapete */}
      <Block p={[-1.1, F + 0.192, 0.4]} s={[0.45, 0.36, 0.8]} color={COLORS.navy} />
      <Block p={[-1.1, F + 0.392, 0.4]} s={[0.55, 0.04, 0.9]} color={WOOD} />

      {/* Candeeiro de arco: pé, haste, braço na diagonal por cima do sofá e abajur */}
      <Cylinder p={[-2.65, F + 0.02, -0.95]} r={0.18} h={0.04} color={DARK} />
      <Cylinder p={[-2.65, F + 0.92, -0.95]} r={0.025} h={1.76} color={DARK} />
      <Block p={[-2.2, F + 1.78, -0.5]} s={[1.3, 0.04, 0.04]} rotY={-Math.PI / 4} color={DARK} />
      <Cylinder p={[-1.74, F + 1.66, -0.04]} r={0.2} h={0.22} color={COLORS.navy} />

      <Foosball x={1.5} z={0.3} />

      <Plant x={2.55} z={-2.0} />
      <Plant x={2.55} z={2.0} />
    </>
  );
}
