import { describe, expect, it } from "vitest";
import { editedAt, formatDate, initials, timeAgo } from "./format.ts";

describe("initials", () => {
  it("letras simples, em maiúsculas", () => {
    expect(initials(" ana ", "silva")).toBe("AS");
  });

  it("não parte emojis nem letras com acento combinado", () => {
    expect(initials("🎓 Ana", "👩🏽‍💻 Silva")).toBe("🎓👩🏽‍💻");
    expect(initials("élia", "Zoë")).toBe("ÉZ");
  });

  it("nomes vazios dão string vazia", () => {
    expect(initials("", "  ")).toBe("");
  });
});

describe("formatDate", () => {
  const now = new Date(2026, 10, 3, 12);

  it("a data curta só leva o ano quando não é o deste ano", () => {
    expect(formatDate("2026-11-01", { short: true, now })).toBe("1 Nov");
    expect(formatDate("2025-11-01", { short: true, now })).toBe("1 Nov 2025");
    expect(formatDate("2027-01-15", { short: true, now })).toBe("15 Jan 2027");
    expect(formatDate("2026-11-01", { now })).toBe("1 Nov 2026");
  });

  it("uma data inválida dá texto vazio em vez de RangeError", () => {
    for (const bad of ["", "nope", "2026-02-31T99:00:00Z"]) {
      expect(formatDate(bad)).toBe("");
      expect(formatDate(bad, { short: true })).toBe("");
      expect(timeAgo(bad)).toBe("");
      expect(editedAt(bad)).toBe("");
    }
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 10, 2, 12);
  it("uma data no futuro (relógio do browser atrasado) dá 'just now', nunca 'in 3 days'", () => {
    expect(timeAgo(new Date(2026, 10, 5, 12).toISOString(), now)).toBe("just now");
    expect(timeAgo(new Date(2026, 10, 2, 9).toISOString(), now)).toBe("3 hours ago");
  });
});

describe("editedAt", () => {
  const now = new Date(2026, 10, 3, 12);

  it("relativo na última semana, depois a data curta", () => {
    expect(editedAt(new Date(2026, 10, 3, 11, 59, 50).toISOString(), now)).toBe("just now");
    expect(editedAt(new Date(2026, 10, 3, 9).toISOString(), now)).toBe("3 hours ago");
    expect(editedAt(new Date(2026, 10, 2, 12).toISOString(), now)).toBe("yesterday");
    expect(editedAt(new Date(2026, 9, 28, 12).toISOString(), now)).toBe("6 days ago");
    expect(editedAt(new Date(2026, 9, 27, 11).toISOString(), now)).toBe("27 Oct");
    expect(editedAt(new Date(2025, 11, 31, 12).toISOString(), now)).toBe("31 Dec 2025");
    // Relógio do computador atrasado: nunca "tomorrow".
    expect(editedAt(new Date(2026, 10, 4, 12).toISOString(), now)).toBe("just now");
  });
});
