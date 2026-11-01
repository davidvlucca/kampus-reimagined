import { BoxGeometry, CylinderGeometry, MeshStandardMaterial } from "three";

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

/** Material fosco de uma cor, criado uma vez. */
export function mat(color: string): MeshStandardMaterial {
  let m = cache.get(color);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
    cache.set(color, m);
  }
  return m;
}

/** Geometrias unitárias partilhadas: cada peça é escalada a partir destas. */
export const BOX = new BoxGeometry(1, 1, 1);
export const CYLINDER = new CylinderGeometry(0.5, 0.5, 1, 20);
