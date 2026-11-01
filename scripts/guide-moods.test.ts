import { existsSync, readFileSync } from "node:fs";
import { GUIDE_MOODS, GUIDES, guideImage, TOUR_STOPS, type GuideId } from "@kampus/shared";
import { describe, expect, it } from "vitest";
import { renderMoods } from "./guide-moods.ts";

describe("expressões dos guias", () => {
  it("os ficheiros em client/public/tour batem com o que o script gera (correr node scripts/guide-moods.ts)", () => {
    for (const [path, svg] of renderMoods()) expect(readFileSync(path, "utf8"), path).toBe(svg);
  });

  it("existe uma imagem para cada guia em cada expressão e a falar", () => {
    for (const id of Object.keys(GUIDES) as GuideId[]) {
      for (const face of [...GUIDE_MOODS, "talk"] as const) {
        expect(existsSync(`client/public${guideImage(id, face)}`), `${id} ${face}`).toBe(true);
      }
    }
  });
});

describe("perguntas da visita", () => {
  const questions = TOUR_STOPS.flatMap((s) => s.questions);

  it("os ids são únicos em toda a visita (marcam as perguntas já feitas)", () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
  });

  it("no máximo 9 por paragem (atalhos de teclado 1–9) e são perguntas", () => {
    for (const stop of TOUR_STOPS) expect(stop.questions.length).toBeLessThanOrEqual(9);
    for (const q of questions) {
      expect(q.label.endsWith("?"), q.label).toBe(true);
      expect(q.answer.length).toBeGreaterThan(0);
    }
  });
});
