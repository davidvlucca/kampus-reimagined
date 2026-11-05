import { describe, expect, it } from "vitest";
import { GUIDES, TOUR_STOPS } from "./tour.ts";

describe("conteúdo da visita", () => {
  it("tem as oito paragens da planta nova, por esta ordem", () => {
    expect(TOUR_STOPS.map((s) => s.id)).toEqual(["entrance", "web-dev", "ux-ui", "data", "open-space", "kitchen", "rooftop", "farewell"]);
  });

  it("cada paragem tem um guia que existe, uma fala e a descrição do cenário", () => {
    for (const stop of TOUR_STOPS) {
      expect(GUIDES[stop.guide], stop.id).toBeDefined();
      expect(stop.text.length, stop.id).toBeGreaterThan(0);
      expect(stop.sceneAlt.length, stop.id).toBeGreaterThan(0);
    }
  });

  it("cada paragem tem entre uma e três perguntas", () => {
    for (const stop of TOUR_STOPS) {
      expect(stop.questions.length, stop.id).toBeGreaterThanOrEqual(1);
      expect(stop.questions.length, stop.id).toBeLessThanOrEqual(3);
    }
  });

  it("os textos não têm travessões nem nomes reais do edifício", () => {
    const copy = TOUR_STOPS.flatMap((s) => [s.name, s.text, s.sceneAlt, ...s.questions.flatMap((q) => [q.label, q.answer])]);
    for (const text of copy) {
      expect(text, text).not.toMatch(/[—–]/);
      // A planta vem de um edifício real: nem a empresa nem a rua aparecem na app.
      expect(text, text).not.toMatch(/ironhack|alf[aâ]ndega|infante|virg[ií]lio/i);
    }
  });

  it("a resposta sobre o acesso não promete o que não se pode garantir", () => {
    const answer = TOUR_STOPS[0]!.questions.find((q) => q.id === "get-there")!.answer;
    expect(answer).toContain("If you need step-free access, tell me before day 1 and we'll sort it out.");
    expect(answer).not.toContain("step-free.");
  });
});
