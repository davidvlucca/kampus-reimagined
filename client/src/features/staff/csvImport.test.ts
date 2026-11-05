import { describe, expect, it } from "vitest";
import { parseCsv, readImport } from "./csvImport.ts";

const COHORT = "7986c509-4171-4a90-bd63-5d6bad8059e5";

describe("Import CSV", () => {
  it("lê vírgulas, ponto e vírgula, aspas e linhas vazias", () => {
    expect(parseCsv('a,b\r\n\r\n"c, d","e ""x"""\n')).toEqual([
      ["a", "b"],
      ["c, d", 'e "x"'],
    ]);
    expect(parseCsv("Ana;Silva;ana@example.com;Welcome2026")).toEqual([["Ana", "Silva", "ana@example.com", "Welcome2026"]]);
  });

  it("salta o cabeçalho, valida com o Zod da API e apanha emails repetidos", () => {
    const rows = readImport(
      [
        "First name,Last name,Email,Password",
        "Ana,Silva,Ana.Silva@Example.com,Welcome2026",
        "Rui,Costa,not-an-email,Welcome2026",
        "Eva,Lopes,ana.silva@example.com,Welcome2026",
        "Só,Três,colunas@example.com",
        "Tó,Zé,to@example.com,short",
      ].join("\n"),
      COHORT,
    );
    expect(rows.map((r) => [r.line, r.error])).toEqual([
      [2, null],
      [3, "Email: Enter a valid email"],
      [4, "Email: Already in this file"],
      [5, "Needs 4 columns: first name, last name, email, password"],
      [6, "Password: At least 8 characters"],
    ]);
    // O email vai em minúsculas, como a API o guarda.
    expect(rows[0]!.input).toEqual({ firstName: "Ana", lastName: "Silva", email: "ana.silva@example.com", password: "Welcome2026", cohortId: COHORT });
  });
});
