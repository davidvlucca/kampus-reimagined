export type Mode = "focus" | "break";

const other = (mode: Mode): Mode => (mode === "focus" ? "break" : "focus");

/**
 * O modo `mode` acabou em `target`: o modo e a hora-alvo seguintes. Encadeia a partir da
 * hora-alvo (e não de `now`, para não perder tempo) e salta os modos que já passaram inteiros
 * com o separador escondido.
 */
export function nextPhase(mode: Mode, target: number, minutes: Record<Mode, number>, now: number): { mode: Mode; target: number } {
  let nextMode = other(mode);
  let nextTarget = target + minutes[nextMode] * 60_000;
  while (nextTarget <= now) {
    nextMode = other(nextMode);
    nextTarget += minutes[nextMode] * 60_000;
  }
  return { mode: nextMode, target: nextTarget };
}
