import { createContext, useContext } from "react";
import { mat } from "./materials.ts";

// Dentro de uma sala, o resto da planta fica "apagado" (cores puxadas para o fundo), para se ver
// logo onde se está: num ecrã largo a câmara mostra sempre as salas do lado.
export const Dim = createContext(false);

/** O material de uma cor, apagado se a peça estiver fora da sala atual. */
export function useMat(color: string) {
  return mat(color, useContext(Dim));
}
