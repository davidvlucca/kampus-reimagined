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

  it("tira as marcas de lista, de título e de citação do início das linhas", () => {
    expect(excerpt("- Best way to ask for help?\n- Where do we hand in exercises?")).toBe("Best way to ask for help? Where do we hand in exercises?");
    expect(excerpt("## Day 1\n1. Doors open\n2) Lunch\n* [x] Laptop\n> Quote")).toBe("Day 1 Doors open Lunch Laptop Quote");
    // A meio da linha fica como está.
    expect(excerpt("Room 2-14 is #3 on the list")).toBe("Room 2-14 is #3 on the list");
  });
});
