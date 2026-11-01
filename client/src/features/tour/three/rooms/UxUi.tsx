import { Block, Cylinder, Shadow } from "../CampusModel.tsx";
import { BOX, COLORS, mat } from "../materials.ts";

// Móveis da sala "ux-ui". Coordenadas locais: origem no centro da sala, chão em y = 0.08.
// Estúdio de design: quadro branco com wireframes a norte, parede de post-its a oeste e uma
// mesa grande partilhada ao centro, com bancos, um portátil e blocos de esboço.

const FLOOR = 0.08;
const TABLE_TOP = FLOOR + 0.75;
const WALL_N = -2.42;
const WALL_W = -2.92;

// Os painéis de parede ficam presos pelo topo e inclinados, para se lerem com a câmara alta.
const HINGE_N = 1.65;
const HINGE_W = 1.12;
const TILT = 0.55;

const YELLOW = "#FDE68A";
const CORAL = "#F28C6B";
const GREY = "#CBD5E1";
const WOOD = "#D9B48F";

// Wireframe no quadro: centro (x, y) e tamanho (largura, altura) de cada caixa.
const WIREFRAME: [number, number, number, number, string][] = [
  [0, 1.5, 2.1, 0.12, COLORS.blue],
  [-0.6, 1.12, 0.8, 0.5, COLORS.sky],
  [0.5, 1.28, 0.9, 0.08, GREY],
  [0.4, 1.12, 0.7, 0.08, GREY],
  [0.45, 0.96, 0.8, 0.08, GREY],
  [-0.6, 0.76, 0.8, 0.1, GREY],
];

// Post-its na parede oeste: (z, y, cor).
const NOTES: [number, number, string][] = [
  [-1.3, 0.95, YELLOW],
  [-0.95, 0.95, CORAL],
  [-0.6, 0.95, YELLOW],
  [-0.25, 0.95, COLORS.sky],
  [-1.3, 0.68, COLORS.sky],
  [-0.95, 0.68, YELLOW],
  [-0.6, 0.68, YELLOW],
  [-0.25, 0.68, CORAL],
  [-1.12, 0.41, YELLOW],
  [-0.42, 0.41, COLORS.sky],
];

export function UxUiRoom() {
  const tz = -0.15;
  return (
    <>
      {/* Quadro branco com wireframes, preso no alto da parede norte e inclinado para a câmara */}
      <group position={[0, HINGE_N, WALL_N]} rotation={[-TILT, 0, 0]}>
        <Block p={[0, 1.1 - HINGE_N, 0.02]} s={[2.6, 1.1, 0.04]} color={GREY} />
        <Block
          p={[0, 1.1 - HINGE_N, 0.05]}
          s={[2.48, 0.98, 0.03]}
          color={COLORS.surface}
        />
        {WIREFRAME.map(([x, y, w, h, color], i) => (
          <Block
            key={i}
            p={[x, y - HINGE_N, 0.07]}
            s={[w, h, 0.02]}
            color={color}
          />
        ))}
      </group>

      {/* Parede de post-its a oeste: um painel inclinado para a câmara, com os papéis colados */}
      <group position={[WALL_W, HINGE_W, 0]} rotation={[0, 0, TILT]}>
        <Block
          p={[0.015, 0.68 - HINGE_W, -0.78]}
          s={[0.03, 0.82, 1.5]}
          color="#E2E8F0"
        />
        {NOTES.map(([z, y, color], i) => (
          <Block
            key={i}
            p={[0.04, y - HINGE_W, z]}
            s={[0.02, 0.22, 0.22]}
            color={color}
          />
        ))}
      </group>

      {/* Mesa grande partilhada */}
      <Shadow x={0.2} z={tz} w={2.9} d={1.6} />
      <Block
        p={[0.2, TABLE_TOP - 0.03, tz]}
        s={[2.6, 0.06, 1.3]}
        color={COLORS.surface}
      />
      <Block
        p={[-0.9, FLOOR + 0.36, tz]}
        s={[0.08, 0.72, 1.1]}
        color="#94A3B8"
      />
      <Block
        p={[1.3, FLOOR + 0.36, tz]}
        s={[0.08, 0.72, 1.1]}
        color="#94A3B8"
      />

      {/* Em cima da mesa: portátil e blocos de esboço */}
      <Block
        p={[0.7, TABLE_TOP + 0.01, tz + 0.15]}
        s={[0.4, 0.02, 0.28]}
        color={GREY}
      />
      <mesh
        geometry={BOX}
        material={mat(COLORS.navy)}
        position={[0.7, TABLE_TOP + 0.12, tz + 0.01]}
        rotation={[-0.3, 0, 0]}
        scale={[0.4, 0.24, 0.02]}
      />
      <Block
        p={[-0.35, TABLE_TOP + 0.01, tz - 0.25]}
        s={[0.42, 0.02, 0.3]}
        color="#FFFFFF"
        rotY={0.2}
      />
      <Block
        p={[-0.2, TABLE_TOP + 0.01, tz + 0.3]}
        s={[0.3, 0.02, 0.3]}
        color={YELLOW}
        rotY={-0.25}
      />

      {/* Bancos à volta da mesa (assento a 0.45 m) */}
      {[
        [-0.5, tz - 0.95],
        [0.9, tz - 0.95],
        [-0.5, tz + 0.95],
        [0.9, tz + 0.95],
        [1.85, tz],
      ].map(([x, z]) => (
        <Cylinder
          key={`${x},${z}`}
          p={[x!, FLOOR + 0.225, z!]}
          r={0.19}
          h={0.45}
          color={WOOD}
        />
      ))}

      {/* Planta no canto nordeste */}
      <Cylinder
        p={[2.55, FLOOR + 0.18, -2.0]}
        r={0.2}
        h={0.36}
        color={COLORS.surface}
      />
      <Cylinder
        p={[2.55, FLOOR + 0.6, -2.0]}
        r={0.26}
        h={0.5}
        color="#86EFAC"
      />
    </>
  );
}
