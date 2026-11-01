import { Block, Cylinder, Shadow } from "../CampusModel.tsx";
import { COLORS } from "../materials.ts";

// Móveis da sala "kitchen". Coordenadas locais: origem no centro da sala, chão em y = 0.08.
// Bancada e frigorífico na parede este; mesa redonda a oeste; a porta do corredor (norte) fica livre.

const F = 0.08;
const TOP = F + 0.9;
const WOOD = "#D9B48F";
const LIGHT = "#E2E8F0";
const STEEL = "#94A3B8";
const SLATE = "#475569";
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

/** Cadeira à volta da mesa. `a` é o ângulo à volta da mesa; o encosto fica sempre para fora. */
function Chair({ cx, cz, a }: { cx: number; cz: number; a: number }) {
  const r = 0.85;
  return (
    <group position={[cx + Math.sin(a) * r, 0, cz + Math.cos(a) * r]} rotation={[0, a, 0]}>
      <Cylinder p={[0, F + 0.21, 0]} r={0.04} h={0.42} color={SLATE} />
      <Block p={[0, F + 0.45, 0]} s={[0.42, 0.05, 0.42]} color={COLORS.blue} />
      <Block p={[0, F + 0.7, 0.19]} s={[0.42, 0.45, 0.05]} color={COLORS.blue} />
    </group>
  );
}

export function KitchenRoom() {
  const tx = -0.9;
  const tz = 0.5;
  return (
    <>
      {/* Frigorífico alto no canto nordeste */}
      <Block p={[2.59, F + 0.9, -2.09]} s={[0.66, 1.8, 0.66]} color={LIGHT} />
      <Block p={[2.25, F + 1.15, -1.9]} s={[0.03, 0.55, 0.04]} color={COLORS.navy} />

      {/* Bancada ao longo da parede este */}
      <Shadow x={2.5} z={-0.11} w={1.0} d={3.4} />
      <Block p={[2.62, F + 0.43, -0.11]} s={[0.6, 0.86, 3.22]} color={COLORS.blue} />
      <Block p={[2.6, F + 0.88, -0.11]} s={[0.64, 0.04, 3.26]} color={LIGHT} />
      {/* Lava-loiça e torneira */}
      <Block p={[2.58, TOP - 0.004, 0.65]} s={[0.4, 0.02, 0.55]} color={STEEL} />
      <Cylinder p={[2.84, TOP + 0.12, 0.65]} r={0.025} h={0.24} color={SLATE} />
      {/* Micro-ondas com a porta virada para a sala */}
      <Block p={[2.68, TOP + 0.14, -1.2]} s={[0.4, 0.28, 0.5]} color={COLORS.surface} />
      <Block p={[2.47, TOP + 0.14, -1.25]} s={[0.02, 0.2, 0.32]} color={COLORS.navy} />
      {/* Máquina de café e jarro */}
      <Block p={[2.74, TOP + 0.2, -0.35]} s={[0.3, 0.4, 0.3]} color={DARK} />
      <Cylinder p={[2.52, TOP + 0.08, -0.35]} r={0.08} h={0.16} color={COLORS.sky} />

      {/* Garrafão de água no canto noroeste */}
      <Block p={[-2.62, F + 0.5, -2.1]} s={[0.36, 1.0, 0.36]} color={LIGHT} />
      <Cylinder p={[-2.62, F + 1.18, -2.1]} r={0.13} h={0.36} color={COLORS.sky} />

      {/* Mesa redonda de madeira com quatro cadeiras */}
      <Shadow x={tx} z={tz} w={1.5} d={1.5} />
      <Cylinder p={[tx, F + 0.015, tz]} r={0.28} h={0.03} color={SLATE} />
      <Cylinder p={[tx, F + 0.36, tz]} r={0.06} h={0.7} color={SLATE} />
      <Cylinder p={[tx, F + 0.73, tz]} r={0.6} h={0.05} color={WOOD} />
      {[0.25, 0.75, 1.25, 1.75].map((k) => (
        <Chair key={k} cx={tx} cz={tz} a={k * Math.PI} />
      ))}

      <Plant x={2.55} z={2.05} />
    </>
  );
}
