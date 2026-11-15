import { describe, expect, it } from "vitest";
import { nextPhase } from "./pomodoroTimer.ts";

const MIN = 60_000;
const minutes = { focus: 25, break: 5 };

describe("Pomodoro: o modo seguinte", () => {
  it("o foco acaba e começa a pausa, contada a partir da hora-alvo", () => {
    // O tique chegou 200 ms depois: a pausa acaba 5 min depois do alvo, não do tique.
    expect(nextPhase("focus", 1_000_000, minutes, 1_000_200)).toEqual({ mode: "break", target: 1_000_000 + 5 * MIN });
  });

  it("a pausa acaba e volta o foco", () => {
    expect(nextPhase("break", 0, minutes, 0)).toEqual({ mode: "focus", target: 25 * MIN });
  });

  it("com o separador escondido, salta os modos que já passaram inteiros", () => {
    // O foco acabou há 40 min: pausa (5), foco (25), pausa (5) já passaram; vai a meio do foco seguinte.
    expect(nextPhase("focus", 0, minutes, 40 * MIN)).toEqual({ mode: "focus", target: 60 * MIN });
    // Exatamente no fim de um modo, já conta o seguinte.
    expect(nextPhase("focus", 0, minutes, 5 * MIN)).toEqual({ mode: "focus", target: 30 * MIN });
  });
});
