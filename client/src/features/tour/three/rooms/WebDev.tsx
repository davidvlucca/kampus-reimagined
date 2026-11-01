import { Block, Shadow } from "../CampusModel.tsx";
import { useMat } from "../dim.ts";
import { BOX, COLORS } from "../materials.ts";

// Móveis da sala "web-dev". Coordenadas locais: origem no centro da sala, chão em y = 0.08.
// Sala de programação: ecrã grande com "código" na parede norte e duas filas de mesas com
// portáteis, viradas para o ecrã. A porta (a sul, x ∈ [−1, 1]) fica livre.

const FLOOR = 0.08;
const DESK_TOP = FLOOR + 0.75;
const WALL_N = -2.42;

/** Tampa de portátil aberta: caixa fina inclinada para trás (o ecrã fica virado para sul). */
function LaptopLid({ x, z }: { x: number; z: number }) {
  return (
    <mesh
      geometry={BOX}
      material={useMat(COLORS.navy)}
      position={[x, DESK_TOP + 0.12, z]}
      rotation={[-0.3, 0, 0]}
      scale={[0.36, 0.24, 0.02]}
    />
  );
}

/** Cadeira simples: corpo assente no chão (assento a 0.45 m) e costas. Virada para norte. */
function Chair({ x, z }: { x: number; z: number }) {
  const seat = FLOOR + 0.45;
  return (
    <>
      <Block
        p={[x, FLOOR + 0.225, z]}
        s={[0.4, 0.45, 0.4]}
        color={COLORS.blue}
      />
      <Block
        p={[x, seat + 0.17, z + 0.18]}
        s={[0.4, 0.34, 0.05]}
        color={COLORS.indigo}
      />
    </>
  );
}

/** Uma fila: mesa comprida com dois pés laterais, três portáteis e três cadeiras. */
function DeskRow({ z }: { z: number }) {
  const seats = [-1.6, 0, 1.6];
  return (
    <>
      <Shadow x={0} z={z} w={5} d={0.8} />
      <Block
        p={[0, DESK_TOP - 0.03, z]}
        s={[4.8, 0.06, 0.62]}
        color={COLORS.surface}
      />
      <Block
        p={[-2.3, FLOOR + 0.36, z]}
        s={[0.06, 0.72, 0.56]}
        color="#94A3B8"
      />
      <Block
        p={[2.3, FLOOR + 0.36, z]}
        s={[0.06, 0.72, 0.56]}
        color="#94A3B8"
      />
      {seats.map((x) => (
        <group key={x}>
          <LaptopLid x={x} z={z - 0.1} />
          <Chair x={x} z={z + 0.55} />
        </group>
      ))}
    </>
  );
}

// Linhas de "código": recuo, largura e cor de cada barra.
const CODE: [number, number, string][] = [
  [0, 1.1, COLORS.sky],
  [0.25, 0.8, "#F28C6B"],
  [0.5, 1.2, "#86EFAC"],
  [0.5, 0.6, COLORS.sky],
  [0.25, 0.9, "#FDE68A"],
  [0, 0.5, COLORS.sky],
];

export function WebDevRoom() {
  const left = -1.2;
  return (
    <>
      {/* Ecrã grande na parede norte: preso no alto e inclinado para se ler com a câmara alta */}
      <group position={[0, 1.68, WALL_N]} rotation={[-0.55, 0, 0]}>
        <Block
          p={[0, -0.56, 0.03]}
          s={[2.8, 1.12, 0.06]}
          color={COLORS.indigo}
        />
        <Block
          p={[0, -0.56, 0.07]}
          s={[2.64, 0.96, 0.03]}
          color={COLORS.navy}
        />
        {CODE.map(([indent, w, color], i) => (
          <Block
            key={i}
            p={[left + indent + w / 2, -0.2 - i * 0.14, 0.09]}
            s={[w, 0.07, 0.02]}
            color={color}
          />
        ))}
      </group>

      {/* Duas filas de mesas viradas para o ecrã */}
      <DeskRow z={-1.05} />
      <DeskRow z={0.45} />
    </>
  );
}
