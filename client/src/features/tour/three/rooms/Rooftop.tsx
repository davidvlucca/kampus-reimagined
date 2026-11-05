import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { Block } from "../CampusModel.tsx";
import { ROOF_Y, SHELL_D, SHELL_W, WALL_H, wx, wz } from "../layout.ts";
import { COLORS } from "../materials.ts";
import { Boxes, Cylinders, LEAF, SLATE, WOOD, YELLOW, type Box } from "./parts.tsx";

// O terraço por cima do edifício. Só existe enquanto a paragem do rooftop está à vista: a laje
// desce e assenta nas paredes (a câmara sobe com ela) e, ao sair, volta a subir e desaparece.
// Coordenadas da planta, com y a partir do chão do terraço.

const LIFT = 7;
const LIFT_S = 1.0;
/** A sair sobe mais depressa: o mapa (e as etiquetas) ficam logo à vista. */
const LEAVE_S = 0.6;
const DECK = "#EFE6DA";
const PLANTER = "#3F9A63";
// Posição de partida, fixa: o useFrame é que a muda (uma prop nova a cada render repunha-a).
const START: [number, number, number] = [wx(0), ROOF_Y + LIFT, wz(0)];
// A laje vai do friso das paredes até ao chão do terraço.
const SLAB = ROOF_Y - WALL_H - 0.06;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

// Floreiras baixas em três lados (o sul fica aberto para o rio), como na planta do terraço.
const PLANTERS: Box[] = [
  ...[0.6, 3, 5.4, 7.8, 10.2, 12.6, 15].map((x): Box => [[x + 0.95, 0.25, 0.8], [1.9, 0.5, 0.8]]),
  ...[2.4, 5, 7.6, 10.2, 12.8].flatMap((y) => [0.8, 16.2].map((x): Box => [[x, 0.25, y + 0.95], [0.8, 0.5, 1.9]])),
];
const LEAVES: Box[] = PLANTERS.map(([p, s]): Box => [[p[0], 0.6, p[2]], [s[0] - 0.3, 0.25, s[2] - 0.3]]);

// Bancos de madeira (a norte) e o banco comprido junto ao parapeito sul.
const BENCHES: Box[] = [
  ...[4.5, 5.8, 9.5, 10.8].map((y): Box => [[4.6, 0.22, y + 0.35], [3.2, 0.44, 0.7]]),
  ...[6, 7.3, 10.5, 11.8].map((y): Box => [[11.6, 0.22, y + 0.35], [3.2, 0.44, 0.7]]),
  [[8.5, 0.22, 26.6], [14, 0.44, 0.8]],
];
// Mesas altas de bar (cilindros brancos).
const TABLES = [
  [3.5, 0.5, 18, 0.6, 1.0],
  [5.5, 0.5, 22, 0.6, 1.0],
  [2.5, 0.5, 22.5, 0.6, 1.0],
] as const;

// Fios de luzes: vértices em zigue-zague (x, y da planta), a 2,3 m do chão do terraço.
const STRINGS: [number, number][][] = [
  [
    [1, 3],
    [4, 4.2],
    [7, 3],
    [10, 4.2],
    [13, 3],
    [16, 4.2],
  ],
  [
    [1, 14.5],
    [4, 15.7],
    [7, 14.5],
    [9.5, 15.2],
  ],
  [
    [1, 21],
    [4, 22.2],
    [7, 21],
    [10, 22.2],
    [13, 21],
    [16, 22.2],
  ],
];
const WIRE_Y = 2.3;
const WIRES: Box[] = STRINGS.flatMap((s) =>
  s.slice(1).map((b, i): Box => {
    const a = s[i]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    return [[(a[0] + b[0]) / 2, WIRE_Y, (a[1] + b[1]) / 2], [Math.hypot(dx, dz), 0.03, 0.03], -Math.atan2(dz, dx)];
  }),
);
const BULBS: Box[] = STRINGS.flatMap((s) =>
  s.slice(1).flatMap((b, i) => {
    const a = s[i]!;
    return [0.25, 0.5, 0.75].map((k): Box => [[a[0] + (b[0] - a[0]) * k, WIRE_Y - 0.1, a[1] + (b[1] - a[1]) * k], [0.12, 0.14, 0.12]]);
  }),
);
const POLES = STRINGS.flatMap((s) => [s[0]!, s[s.length - 1]!]).map(([x, y]) => [x, WIRE_Y / 2, y, 0.04, WIRE_Y] as const);

// Parapeito baixo a norte, oeste e este; a sul, só um vidro baixo (a vista do rio).
const PARAPET: Box[] = [
  [[SHELL_W / 2, 0.3, 0.08], [SHELL_W, 0.6, 0.16]],
  [[0.08, 0.3, SHELL_D / 2], [0.16, 0.6, SHELL_D]],
  [[SHELL_W - 0.08, 0.3, SHELL_D / 2], [0.16, 0.6, SHELL_D]],
];

function Terrace() {
  return (
    <>
      {/* Laje e deck: o clique nele não chega às salas lá em baixo */}
      <group onClick={(e) => e.stopPropagation()} onPointerOver={(e) => e.stopPropagation()}>
        <Block p={[SHELL_W / 2, -SLAB / 2 - 0.02, SHELL_D / 2]} s={[SHELL_W + 0.2, SLAB, SHELL_D + 0.2]} color={COLORS.indigo} />
        <Block p={[SHELL_W / 2, -0.01, SHELL_D / 2]} s={[SHELL_W + 0.2, 0.02, SHELL_D + 0.2]} color={DECK} />
      </group>
      <Boxes items={PARAPET} color={COLORS.wall} />
      <Block p={[SHELL_W / 2, 0.45, SHELL_D - 0.05]} s={[SHELL_W, 0.9, 0.05]} color="#CFEFFC" />
      <Block p={[SHELL_W / 2, 0.92, SHELL_D - 0.05]} s={[SHELL_W, 0.05, 0.08]} color={COLORS.blue} />

      {/* Casa das escadas e do elevador, por cima do núcleo, e o bar encostado a ela */}
      <Block p={[12.05, 0.8, 17]} s={[5.1, 1.6, 4]} color={COLORS.indigo} />
      <Block p={[10.8, 0.6, 18.98]} s={[1.6, 1.0, 0.05]} color={COLORS.sky} />
      <Block p={[12.05, 0.5, 20]} s={[4.5, 1.0, 0.8]} color={WOOD} />
      <Block p={[12.05, 1.02, 20]} s={[4.6, 0.05, 0.9]} color={SLATE} />

      <Boxes items={PLANTERS} color={PLANTER} />
      <Boxes items={LEAVES} color={LEAF} />
      <Boxes items={BENCHES} color={WOOD} />
      <Cylinders items={TABLES} color={COLORS.surface} />
      <Cylinders items={POLES} color={SLATE} />
      <Boxes items={WIRES} color={SLATE} />
      <Boxes items={BULBS} color={YELLOW} />
    </>
  );
}

/** O terraço, com a descida e a subida. Com `animate` a false (reduced motion) aparece logo. */
export function RoofLevel({
  shown,
  animate,
  onPresent,
}: {
  shown: boolean;
  animate: boolean;
  /** O terraço apareceu ou desapareceu de vez (enquanto está, as etiquetas do rés-do-chão escondem-se). */
  onPresent: (present: boolean) => void;
}) {
  const ref = useRef<Group>(null);
  // 0: lá em cima e escondido; 1: assente no edifício.
  const k = useRef(0);
  const [present, setPresent] = useState(shown);
  const invalidate = useThree((s) => s.invalidate);
  if (shown && !present) setPresent(true);

  useEffect(() => {
    invalidate();
  }, [shown, invalidate]);
  useEffect(() => onPresent(present), [present, onPresent]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const target = shown ? 1 : 0;
    if (!animate) k.current = target;
    else if (k.current !== target) {
      // O mesmo limite do voo da câmara: depois de muito tempo parado o delta pode ser enorme.
      const step = Math.min(delta, 0.1) / (shown ? LIFT_S : LEAVE_S);
      k.current = target > k.current ? Math.min(1, k.current + step) : Math.max(0, k.current - step);
      invalidate();
    }
    g.position.y = ROOF_Y + (1 - easeOut(k.current)) * LIFT;
    if (k.current === 0 && !shown) setPresent(false);
  });

  if (!present) return null;
  return (
    <group ref={ref} position={START}>
      <Terrace />
    </group>
  );
}
