import { BoxGeometry, Color, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from "three";

// Paleta do Kampus. Um material por cor, partilhado por todas as peças (menos trabalho para a GPU).
export const COLORS = {
  ink: "#00072D",
  navy: "#001C55",
  indigo: "#0A2472",
  blue: "#0E6BA8",
  sky: "#A6E1FA",
  surface: "#F8FAFC",
  wall: "#F8FAFC",
  wallCap: "#0E6BA8",
  corridor: "#C7D8EB",
  base: "#0A2472",
} as const;

const cache = new Map<string, MeshStandardMaterial>();

/** Quanto uma peça "apagada" se aproxima do fundo (as salas vizinhas, quando se está numa sala). */
const DIM = 0.6;

/** Material fosco de uma cor, criado uma vez. Com `dim`, a mesma cor puxada para o fundo. */
export function mat(color: string, dim = false): MeshStandardMaterial {
  const key = dim ? `${color}|dim` : color;
  let m = cache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color: dim ? new Color(color).lerp(new Color(COLORS.ink), DIM) : color, roughness: 0.85, metalness: 0 });
    cache.set(key, m);
  }
  return m;
}

/** Geometrias unitárias partilhadas: cada peça é escalada a partir destas. */
export const BOX = new BoxGeometry(1, 1, 1);
export const CYLINDER = new CylinderGeometry(0.5, 0.5, 1, 20);

/** Liberta da GPU tudo o que é partilhado (ao desmontar o 3D). Os objetos continuam utilizáveis. */
export function disposeShared() {
  for (const m of cache.values()) m.dispose();
  BOX.dispose();
  CYLINDER.dispose();
  SHADOW.dispose();
  PLANE.dispose();
}

/** Sombra falsa: um plano escuro semitransparente no chão, sem shadow maps (barato no telemóvel). */
export const SHADOW = new MeshBasicMaterial({ color: "#001C55", transparent: true, opacity: 0.14, depthWrite: false });
export const PLANE = new PlaneGeometry(1, 1);
