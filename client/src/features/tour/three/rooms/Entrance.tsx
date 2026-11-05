import { Block, Shadow } from "../CampusModel.tsx";
import { useMat } from "../dim.ts";
import { COLORS, CYLINDER } from "../materials.ts";
import { AtPlan, Boxes, CORAL, DARK, F, Plant, WOOD, type Box } from "./parts.tsx";

// Entrance e receção (60 m²), em coordenadas da planta: x 0–7,5, y 20–28. A porta principal fica
// na fachada oeste (y 24,45–25,75), virada para a rua pedonal; o caminho até ao corredor fica livre.

/** Roda de bicicleta: um cilindro fino deitado de lado (eixo ao longo de x local). */
function Wheel({ x }: { x: number }) {
  return <mesh geometry={CYLINDER} material={useMat(DARK)} position={[x, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.44, 0.04, 0.44]} />;
}

/** Bicicleta estacionada na rua, ao comprido da fachada (norte-sul). Fica fora do edifício. */
function Bike({ px, py, color }: { px: number; py: number; color: string }) {
  return (
    <group position={[px, 0.04, py]} rotation={[0, Math.PI / 2, 0]}>
      <Wheel x={-0.3} />
      <Wheel x={0.3} />
      {/* Quadro: tubo de cima, tubo do selim e garfo */}
      <Block p={[0.05, 0.54, 0]} s={[0.46, 0.05, 0.05]} color={color} />
      <Block p={[-0.18, 0.46, 0]} s={[0.05, 0.4, 0.05]} color={color} />
      <Block p={[0.28, 0.48, 0]} s={[0.05, 0.44, 0.05]} color={color} />
      <Block p={[0.28, 0.71, 0]} s={[0.04, 0.04, 0.3]} color={DARK} />
    </group>
  );
}

// Cacifos ao longo da parede oeste, a norte da porta: 2 alturas × 5.
const LOCKERS: Box[] = [0, 1, 2, 3, 4].flatMap((i) => [0.25, 0.75].map((y): Box => [[0.28, F + y, 20.6 + i * 0.62], [0.42, 0.46, 0.58]]));

export function EntranceRoom() {
  return (
    <AtPlan room="entrance">
      {/* Balcão da receção em L, com o vidro azul-céu por cima */}
      <Shadow x={5} z={22.2} w={3} d={2.2} />
      <Block p={[4.95, F + 0.45, 21.6]} s={[2.7, 0.9, 0.6]} color={COLORS.indigo} />
      <Block p={[6.0, F + 0.45, 22.55]} s={[0.6, 0.9, 1.3]} color={COLORS.indigo} />
      <Block p={[4.85, F + 0.92, 21.42]} s={[2.3, 0.04, 0.14]} color={COLORS.sky} />
      {/* Monitor e cadeira de quem está atrás do balcão */}
      <Block p={[4.9, F + 1.1, 21.75]} s={[0.55, 0.34, 0.04]} color={COLORS.navy} />
      <Block p={[4.9, F + 0.23, 21.0]} s={[0.42, 0.46, 0.42]} color={COLORS.blue} />

      <Boxes items={LOCKERS} color={COLORS.blue} />
      {/* Tapete da porta */}
      <Block p={[0.75, F + 0.005, 25.1]} s={[0.9, 0.01, 1.1]} color={COLORS.blue} />

      {/* Banco de madeira ao longo da fachada sul */}
      <Shadow x={2.7} z={27.5} w={3.6} d={0.7} />
      <Block p={[2.7, F + 0.2, 27.5]} s={[3.2, 0.4, 0.4]} color={COLORS.navy} />
      <Block p={[2.7, F + 0.43, 27.5]} s={[3.4, 0.06, 0.5]} color={WOOD} />

      <Plant x={0.6} z={27.3} size={1.2} />
      <Plant x={6.9} z={27.35} size={1.2} />
      <Plant x={5.1} z={27.4} />

      {/* Bicicletas lá fora, na rua pedonal */}
      <Bike px={-1.4} py={22.4} color={COLORS.blue} />
      <Bike px={-1.0} py={23.2} color={CORAL} />
    </AtPlan>
  );
}
