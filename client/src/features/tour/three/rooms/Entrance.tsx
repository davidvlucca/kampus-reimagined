import { Block, Cylinder, Shadow } from "../CampusModel.tsx";
import { useMat } from "../dim.ts";
import { COLORS, CYLINDER } from "../materials.ts";

// Móveis da sala "entrance". Coordenadas locais: origem no centro da sala, chão em y = 0.08.
// O corredor do meio (|x| < 0.9) fica livre: é o caminho da porta da rua até à porta do corredor.

const F = 0.08;
const WOOD = "#D9B48F";
const STEEL = "#94A3B8";
const DARK = "#1E293B";
const LEAF = "#86EFAC";
const CORAL = "#F28C6B";

/** Planta num vaso: vaso e duas camadas de folhas. */
function Plant({ x, z }: { x: number; z: number }) {
  return (
    <>
      <Cylinder p={[x, F + 0.17, z]} r={0.17} h={0.34} color={COLORS.indigo} />
      <Cylinder p={[x, F + 0.55, z]} r={0.3} h={0.42} color={LEAF} />
      <Cylinder p={[x, F + 0.91, z]} r={0.19} h={0.3} color={LEAF} />
    </>
  );
}

/** Roda de bicicleta: um cilindro fino deitado de lado (eixo ao longo de z). */
function Wheel({ x, z }: { x: number; z: number }) {
  return <mesh geometry={CYLINDER} material={useMat(DARK)} position={[x, 0.22, z]} rotation={[Math.PI / 2, 0, 0]} scale={[0.44, 0.04, 0.44]} />;
}

/** Bicicleta encostada à fachada, ao longo de x. Fica na base da maqueta (y = 0), fora da sala. */
function Bike({ x, z, color }: { x: number; z: number; color: string }) {
  const rear = x - 0.3;
  const front = x + 0.3;
  return (
    <>
      <Wheel x={rear} z={z} />
      <Wheel x={front} z={z} />
      {/* Quadro: tubo de cima, tubo do selim e garfo */}
      <Block p={[x + 0.05, 0.5, z]} s={[0.46, 0.05, 0.05]} color={color} />
      <Block p={[rear + 0.12, 0.42, z]} s={[0.05, 0.4, 0.05]} color={color} />
      <Block p={[front - 0.02, 0.44, z]} s={[0.05, 0.44, 0.05]} color={color} />
      <Block p={[front - 0.02, 0.67, z]} s={[0.04, 0.04, 0.3]} color={DARK} />
    </>
  );
}

/** Torniquete de um lado do corredor: dois pilaretes com uma barra entre eles. */
function Gate({ side }: { side: 1 | -1 }) {
  const z = 1.25;
  return (
    <>
      <Block p={[side * 1.02, F + 0.45, z]} s={[0.16, 0.9, 0.4]} color={COLORS.navy} />
      <Block p={[side * 1.78, F + 0.45, z]} s={[0.16, 0.9, 0.4]} color={COLORS.navy} />
      <Block p={[side * 1.4, F + 0.72, z]} s={[0.6, 0.07, 0.07]} color={STEEL} />
    </>
  );
}

export function EntranceRoom() {
  return (
    <>
      {/* Receção em L encostada à parede oeste */}
      <Shadow x={-1.6} z={-0.3} w={0.8} d={1.9} />
      <Block p={[-1.6, F + 0.43, -0.25]} s={[0.5, 0.86, 1.6]} color={COLORS.surface} />
      <Block p={[-2.135, F + 0.43, -1.3]} s={[1.57, 0.86, 0.5]} color={COLORS.surface} />
      <Block p={[-1.58, F + 0.88, -0.22]} s={[0.56, 0.04, 1.6]} color={COLORS.indigo} />
      <Block p={[-2.12, F + 0.88, -1.3]} s={[1.6, 0.04, 0.56]} color={COLORS.indigo} />
      {/* Monitor virado para quem está atrás do balcão */}
      <Cylinder p={[-1.66, F + 0.97, -0.3]} r={0.03} h={0.14} color={DARK} />
      <Block p={[-1.66, F + 1.2, -0.3]} s={[0.04, 0.34, 0.6]} color={COLORS.navy} />
      {/* Cadeira da receção */}
      <Block p={[-2.35, F + 0.23, -0.3]} s={[0.42, 0.46, 0.42]} color={COLORS.blue} />
      <Block p={[-2.6, F + 0.68, -0.3]} s={[0.06, 0.44, 0.42]} color={COLORS.blue} />

      {/* Torniquetes junto à porta da rua, um de cada lado do corredor */}
      <Gate side={-1} />
      <Gate side={1} />
      {/* Tapete da porta */}
      <Block p={[0, F + 0.005, 2.0]} s={[1.0, 0.01, 0.5]} color={COLORS.blue} />

      {/* Banco corrido na parede este */}
      <Shadow x={2.62} z={-0.4} w={0.7} d={1.8} />
      <Block p={[2.7, F + 0.2, -0.4]} s={[0.34, 0.4, 1.4]} color={COLORS.navy} />
      <Block p={[2.7, F + 0.43, -0.4]} s={[0.42, 0.06, 1.6]} color={WOOD} />

      <Plant x={2.55} z={-2.05} />

      {/* Bicicletas lá fora, à direita da porta da rua */}
      <Bike x={1.65} z={2.72} color={COLORS.blue} />
      <Bike x={2.05} z={2.96} color={CORAL} />
    </>
  );
}
