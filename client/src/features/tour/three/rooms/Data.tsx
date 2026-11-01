import { Block, Cylinder, Shadow } from "../CampusModel.tsx";
import { useMat } from "../dim.ts";
import { BOX, COLORS, CYLINDER } from "../materials.ts";

// Móveis da sala "data". Coordenadas locais: origem no centro da sala, chão em y = 0.08.
// Sala de dados: três ecrãs grandes na parede norte (barras, linha e donut) e, por baixo,
// uma mesa comprida com monitores e cadeiras. A porta (a sul, x ∈ [−1, 1]) fica livre.

const FLOOR = 0.08;
const DESK_TOP = FLOOR + 0.75;
const WALL_N = -2.42;
const SCREEN_Y = 1.25;
const SCREEN_H = 0.9;
const FACE = WALL_N + 0.07;
const HINGE = SCREEN_Y + SCREEN_H / 2;
const TILT = 0.55;
const CORAL = "#F28C6B";

/** Segmento fino no plano do ecrã, de (x1, y1) a (x2, y2). */
function Segment({ a, b }: { a: [number, number]; b: [number, number] }) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return (
    <mesh
      geometry={BOX}
      material={useMat(COLORS.sky)}
      position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, FACE]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
      scale={[Math.hypot(dx, dy) + 0.04, 0.045, 0.02]}
    />
  );
}

/** Disco com o eixo virado para sul (fica de frente para a câmara, encostado ao ecrã). */
function Disc({
  x,
  y,
  z,
  r,
  color,
}: {
  x: number;
  y: number;
  z: number;
  r: number;
  color: string;
}) {
  return (
    <mesh
      geometry={CYLINDER}
      material={useMat(color)}
      position={[x, y, z]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={[r * 2, 0.02, r * 2]}
    />
  );
}

/** Cadeira simples virada para norte: corpo assente no chão (assento a 0.45 m) e costas. */
function Chair({ x, z }: { x: number; z: number }) {
  return (
    <>
      <Block
        p={[x, FLOOR + 0.225, z]}
        s={[0.4, 0.45, 0.4]}
        color={COLORS.blue}
      />
      <Block
        p={[x, FLOOR + 0.62, z + 0.18]}
        s={[0.4, 0.34, 0.05]}
        color={COLORS.indigo}
      />
    </>
  );
}

const BARS = [0.3, 0.5, 0.38, 0.62, 0.7];
const LINE: [number, number][] = [
  [-0.55, 0.95],
  [-0.2, 1.2],
  [0.12, 1.08],
  [0.55, 1.5],
];

export function DataRoom() {
  const base = SCREEN_Y - SCREEN_H / 2 + 0.12;
  const deskZ = -1.35;
  return (
    <>
      {/* Três ecrãs na parede norte, presos pelo topo e inclinados para se lerem com a câmara alta.
          O grupo interior repõe as coordenadas da sala, para os gráficos usarem valores diretos. */}
      <group position={[0, HINGE, WALL_N]} rotation={[-TILT, 0, 0]}>
        <group position={[0, -HINGE, -WALL_N]}>
          {[-1.85, 0, 1.85].map((x) => (
            <Block
              key={x}
              p={[x, SCREEN_Y, WALL_N + 0.04]}
              s={[1.6, SCREEN_H, 0.06]}
              color={COLORS.navy}
            />
          ))}

          {/* Ecrã 1: gráfico de barras */}
          {BARS.map((h, i) => (
            <Block
              key={i}
              p={[-2.35 + i * 0.25, base + h / 2, FACE]}
              s={[0.16, h, 0.02]}
              color={i === BARS.length - 1 ? COLORS.sky : COLORS.blue}
            />
          ))}

          {/* Ecrã 2: gráfico de linha */}
          {LINE.slice(1).map((b, i) => (
            <Segment key={i} a={LINE[i]!} b={b} />
          ))}

          {/* Ecrã 3: donut (anel céu com o miolo da cor do ecrã) e uma legenda curta */}
          <Disc x={1.6} y={SCREEN_Y} z={FACE} r={0.3} color={COLORS.sky} />
          <Disc
            x={1.6}
            y={SCREEN_Y}
            z={FACE + 0.02}
            r={0.15}
            color={COLORS.navy}
          />
          <Block
            p={[2.25, SCREEN_Y + 0.1, FACE]}
            s={[0.3, 0.06, 0.02]}
            color={COLORS.sky}
          />
          <Block
            p={[2.2, SCREEN_Y - 0.06, FACE]}
            s={[0.2, 0.06, 0.02]}
            color={CORAL}
          />
        </group>
      </group>

      {/* Mesa comprida por baixo dos ecrãs */}
      <Shadow x={0} z={deskZ} w={5.4} d={0.9} />
      <Block
        p={[0, DESK_TOP - 0.03, deskZ]}
        s={[5.2, 0.06, 0.7]}
        color={COLORS.surface}
      />
      <Block
        p={[-2.5, FLOOR + 0.36, deskZ]}
        s={[0.06, 0.72, 0.62]}
        color="#94A3B8"
      />
      <Block
        p={[2.5, FLOOR + 0.36, deskZ]}
        s={[0.06, 0.72, 0.62]}
        color="#94A3B8"
      />

      {/* Monitores e cadeiras */}
      {[-1.7, 0, 1.7].map((x) => (
        <group key={x}>
          <Block
            p={[x, DESK_TOP + 0.08, deskZ - 0.18]}
            s={[0.08, 0.16, 0.06]}
            color="#475569"
          />
          <Block
            p={[x, DESK_TOP + 0.28, deskZ - 0.16]}
            s={[0.62, 0.36, 0.04]}
            color={COLORS.indigo}
          />
          <Chair x={x} z={deskZ + 0.6} />
        </group>
      ))}

      {/* Mesa redonda para conversas (os workshops de sexta), fora da passagem da porta */}
      <Shadow x={1.9} z={0.7} w={0.8} d={0.8} />
      <Cylinder p={[1.9, FLOOR + 0.355, 0.7]} r={0.06} h={0.71} color="#94A3B8" />
      <Cylinder p={[1.9, DESK_TOP - 0.02, 0.7]} r={0.45} h={0.04} color={COLORS.surface} />
      <Cylinder p={[1.25, FLOOR + 0.225, 0.7]} r={0.18} h={0.45} color={COLORS.blue} />
      <Cylinder p={[2.55, FLOOR + 0.225, 0.7]} r={0.18} h={0.45} color={COLORS.blue} />
    </>
  );
}
