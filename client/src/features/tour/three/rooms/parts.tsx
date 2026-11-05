import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Object3D, type InstancedMesh } from "three";
import { Block, Cylinder, Shadow } from "../CampusModel.tsx";
import { useMat } from "../dim.ts";
import { roomById, wx, wz, type RoomId } from "../layout.ts";
import { BOX, COLORS, CYLINDER } from "../materials.ts";

// Peças comuns aos móveis das salas. Os móveis usam as coordenadas da planta aprovada
// (px para este, py para sul, em metros), para baterem certo com o desenho.

export const F = 0.08;
export const DESK_TOP = F + 0.75;
export const WOOD = "#D9B48F";
export const STEEL = "#94A3B8";
export const SLATE = "#475569";
export const DARK = "#1E293B";
export const LEAF = "#86EFAC";
export const CORAL = "#F28C6B";
export const YELLOW = "#FDE68A";
export const LIGHT = "#E2E8F0";

/** Os filhos usam coordenadas da planta: [px, y, py]. Fica dentro do grupo da sala (centrado nela). */
export function AtPlan({ room, children }: { room: RoomId; children: ReactNode }) {
  const r = roomById(room);
  return <group position={[wx(0) - r.x, 0, wz(0) - r.z]}>{children}</group>;
}

/** Caixa: centro [px, y, py], tamanho [largura, altura, fundo] e rotação em y opcional. */
export type Box = readonly [p: readonly [number, number, number], s: readonly [number, number, number], rotY?: number];

const tmp = new Object3D();

/**
 * Muitas caixas da mesma cor numa só chamada à GPU (InstancedMesh). É o que deixa ter as 28
 * mesas da Web Dev sem multiplicar as peças da cena. `items` tem de ser fixo (constante do módulo).
 */
export function Boxes({ items, color }: { items: readonly Box[]; color: string }) {
  const ref = useRef<InstancedMesh>(null);
  const material = useMat(color);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach(([p, s, rotY = 0], i) => {
      tmp.position.set(p[0], p[1], p[2]);
      tmp.rotation.set(0, rotY, 0);
      tmp.scale.set(s[0], s[1], s[2]);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Sem a esfera certa, o raycast (clique na sala) e o corte fora do ecrã usavam a da caixa unitária.
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[BOX, undefined, items.length]} material={material} />;
}

/** Cilindros da mesma cor numa só chamada: centro [px, y, py], raio e altura. */
export function Cylinders({ items, color }: { items: readonly (readonly [number, number, number, number, number])[]; color: string }) {
  const ref = useRef<InstancedMesh>(null);
  const material = useMat(color);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach(([x, y, z, r, h], i) => {
      tmp.position.set(x, y, z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(r * 2, h, r * 2);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[CYLINDER, undefined, items.length]} material={material} />;
}

/** Planta num vaso: vaso e duas camadas de folhas. */
export function Plant({ x, z, size = 1 }: { x: number; z: number; size?: number }) {
  return (
    <>
      <Cylinder p={[x, F + 0.17 * size, z]} r={0.17 * size} h={0.34 * size} color={COLORS.indigo} />
      <Cylinder p={[x, F + 0.55 * size, z]} r={0.3 * size} h={0.42 * size} color={LEAF} />
      <Cylinder p={[x, F + 0.91 * size, z]} r={0.19 * size} h={0.3 * size} color={LEAF} />
    </>
  );
}

/**
 * Painel de parede (ecrã ou quadro) preso pelo topo e inclinado para cima, para se ler com a câmara
 * alta de qualquer lado (ao alto a câmara vem de sul, deitado vem de oeste). `face` é para onde olha.
 */
export function WallPanel({
  x,
  z,
  w,
  h,
  y,
  face,
  color,
  children,
}: {
  x: number;
  z: number;
  w: number;
  h: number;
  /** Altura do topo do painel. */
  y: number;
  face: "south" | "west" | "east" | "north";
  color: string;
  /** Conteúdo no plano do painel: x para a direita de quem olha, y para cima a partir do topo (negativo). */
  children?: ReactNode;
}) {
  const rotY = { south: 0, west: -Math.PI / 2, east: Math.PI / 2, north: Math.PI }[face];
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <group rotation={[-0.75, 0, 0]}>
        <Block p={[0, -h / 2, 0.03]} s={[w, h, 0.05]} color={color} />
        <group position={[0, 0, 0.065]}>{children}</group>
      </group>
    </group>
  );
}

/** Tampa de portátil aberta, virada para `rotY` (0: o ecrã olha para sul). */
export function Lid({ x, z, rotY = 0, y = DESK_TOP }: { x: number; z: number; rotY?: number; y?: number }) {
  return (
    <group position={[x, y + 0.12, z]} rotation={[0, rotY, 0]}>
      <mesh geometry={BOX} material={useMat(COLORS.navy)} rotation={[-0.3, 0, 0]} scale={[0.36, 0.24, 0.02]} />
    </group>
  );
}

/** Mesa redonda com pé e tampo. */
export function RoundTable({ x, z, r, top = WOOD }: { x: number; z: number; r: number; top?: string }) {
  return (
    <>
      <Shadow x={x} z={z} w={r * 2.4} d={r * 2.4} />
      <Cylinder p={[x, F + 0.36, z]} r={0.06} h={0.7} color={SLATE} />
      <Cylinder p={[x, F + 0.73, z]} r={r} h={0.05} color={top} />
    </>
  );
}
