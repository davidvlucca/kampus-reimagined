import { describe, expect, it } from "vitest";
import { excerpt, noteChanges } from "./noteText.ts";

const seed = { title: "Day 1", body: "Doors open at 8:30." };

describe("noteChanges", () => {
  it("só manda o título se só o título mudou (não pisa o corpo guardado noutro separador)", () => {
    expect(noteChanges(seed, "Day 1: welcome", seed.body)).toEqual({ title: "Day 1: welcome" });
  });

  it("só manda o corpo se só o corpo mudou", () => {
    expect(noteChanges(seed, seed.title, "Doors open at 9:00.")).toEqual({ body: "Doors open at 9:00." });
  });

  it("espaços à volta do título não contam como mudança", () => {
    expect(noteChanges(seed, "  Day 1 ", seed.body)).toEqual({});
  });

  it("os dois quando os dois mudaram", () => {
    expect(noteChanges(seed, "New", "")).toEqual({ title: "New", body: "" });
  });
});

describe("excerpt", () => {
  it("junta as linhas e corta no máximo", () => {
    expect(excerpt("a\nb   c")).toBe("a b c");
    expect(excerpt("x".repeat(10), 4)).toBe("xxxx…");
  });
});
