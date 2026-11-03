import { useCallback, useState } from "react";
import { canUseWebGL } from "./three/webgl.ts";

export type TourMode = "2d" | "3d";
const MODE_KEY = "kampus.tourMode";

function readModePref(): TourMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "2d" || v === "3d" ? v : null;
  } catch {
    return null;
  }
}

function saveModePref(mode: TourMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Sem armazenamento (modo privado): a escolha vale só para esta visita.
  }
}

/** 3D por omissão; 2D com reduced motion, sem WebGL, se o WebGL falhar ou se a pessoa escolher. */
export function useTourMode(reducedMotion: boolean) {
  const [lost, setLost] = useState(false);
  const [modePref, setModePref] = useState<TourMode | null>(readModePref);
  const webgl = canUseWebGL() && !lost;
  const is3D = webgl && (modePref ? modePref === "3d" : !reducedMotion);

  /** A escolha fica guardada no browser para a próxima visita. */
  const choose = useCallback((mode: TourMode) => {
    saveModePref(mode);
    setModePref(mode);
  }, []);
  const markLost = useCallback(() => setLost(true), []);

  return { webgl, is3D, choose, markLost };
}
