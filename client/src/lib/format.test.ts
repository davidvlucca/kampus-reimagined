import { describe, expect, it } from "vitest";
import { initials } from "./format.ts";

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
