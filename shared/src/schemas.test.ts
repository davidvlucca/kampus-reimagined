import { describe, expect, it } from "vitest";
import {
  createAssignmentSchema,
  createNoteSchema,
  createStudentSchema,
  createTaskSchema,
  loginSchema,
  studentQuerySchema,
  updateProfileSchema,
} from "./schemas.ts";

const COHORT = "7986c509-4171-4a90-bd63-5d6bad8059e5";
const student = { firstName: "Ana", lastName: "Silva", email: "ana@example.com", cohortId: COHORT, password: "Kampus123" };

/** A mensagem do primeiro erro de um campo, como a API a devolve em `fields`. */
function fieldError(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, field: string) {
  return result.error?.issues.find((i) => i.path.join(".") === field)?.message;
}

describe("texto livre", () => {
  it("recusa o carácter NUL em todos os campos de texto", () => {
    const nul = "a\u0000b";
    expect(fieldError(createTaskSchema.safeParse({ title: nul }), "title")).toBe("Contains an invalid character");
    expect(fieldError(createNoteSchema.safeParse({ title: nul, body: "" }), "title")).toBe("Contains an invalid character");
    // No corpo, o NUL sai (como os outros caracteres de controlo) em vez de dar erro.
    expect(createNoteSchema.parse({ title: "Ok", body: nul }).body).toBe("ab");
    expect(fieldError(updateProfileSchema.safeParse({ firstName: nul, lastName: "Silva" }), "firstName")).toBeDefined();
    expect(fieldError(createStudentSchema.safeParse({ ...student, lastName: nul }), "lastName")).toBeDefined();
    expect(fieldError(createAssignmentSchema.safeParse({ cohortId: COHORT, title: nul }), "title")).toBeDefined();
    expect(fieldError(studentQuerySchema.safeParse({ q: nul }), "q")).toBe("Contains an invalid character");
  });

  it("um título ou nome só com caracteres invisíveis conta como vazio", () => {
    for (const blank of ["​", "‌‍", " ​ ", "﻿", "⁠"]) {
      expect(fieldError(createTaskSchema.safeParse({ title: blank }), "title")).toBe("Required");
      expect(fieldError(updateProfileSchema.safeParse({ firstName: blank, lastName: "Silva" }), "firstName")).toBe("Required");
    }
    // Com texto visível à volta continua a valer (ex.: um emoji com zero-width joiner).
    expect(createTaskSchema.safeParse({ title: "Team 👩‍💻" }).success).toBe(true);
  });

  it("títulos e nomes são uma linha só: quebras de linha são recusadas", () => {
    for (const bad of ["Line 1\nLine 2", "a\rb"]) {
      expect(fieldError(createTaskSchema.safeParse({ title: bad }), "title")).toBe("Use a single line of text");
      expect(fieldError(updateProfileSchema.safeParse({ firstName: "Ana", lastName: bad }), "lastName")).toBe("Use a single line of text");
    }
    // Uma quebra no fim é só espaço à volta: o trim tira-a.
    expect(createTaskSchema.parse({ title: "Read the guide\n" }).title).toBe("Read the guide");
  });

  it("um tab num título ou nome vira espaço em vez de dar erro", () => {
    expect(createTaskSchema.parse({ title: "Read\tthe guide" }).title).toBe("Read the guide");
    expect(updateProfileSchema.parse({ firstName: "\tAna", lastName: "Silva\t" })).toEqual({ firstName: "Ana", lastName: "Silva" });
    expect(fieldError(createTaskSchema.safeParse({ title: "\t\t" }), "title")).toBe("Required");
  });

  it("o corpo da nota pode ter várias linhas", () => {
    expect(createNoteSchema.safeParse({ title: "Day 1", body: "Line 1\nLine 2\r\n\t- item" }).success).toBe(true);
  });

  it("o corpo da nota perde os outros caracteres de controlo e os surrogates soltos", () => {
    // No JSON, quase todos ocupam 6 bytes: 100 notas cheias passavam o limite de resposta da Vercel.
    for (const [bad, clean] of [["a\u0001b", "ab"], ["\u001F", ""], ["\u007F", ""], ["a\u000Bb", "a\nb"], ["a\u000Cb", "a\nb"], ["\uD800", ""], ["x\uDFFFy", "xy"]]) {
      expect(createNoteSchema.parse({ title: "Ok", body: bad }).body).toBe(clean);
    }
    // Um emoji é um par de surrogates certo: fica.
    expect(createNoteSchema.parse({ title: "Ok", body: "Done 🎉" }).body).toBe("Done 🎉");
  });
});

describe("prazos", () => {
  it("aceita datas reais entre 1900 e 2100", () => {
    for (const dueDate of ["2026-11-03", "1900-01-01", "2100-12-31", "2028-02-29"]) {
      expect(createTaskSchema.safeParse({ title: "Ok", dueDate }).success).toBe(true);
    }
  });

  it("um ano de 2 dígitos do seletor de datas (0026) pede uma data entre 1900 e 2100", () => {
    for (const dueDate of ["0026-11-03", "1899-12-31", "2101-01-01", "9999-01-01"]) {
      expect(fieldError(createTaskSchema.safeParse({ title: "Ok", dueDate }), "dueDate")).toBe("Use a date between 1900 and 2100");
      expect(fieldError(createAssignmentSchema.safeParse({ cohortId: COHORT, title: "Ok", dueDate }), "dueDate")).toBe("Use a date between 1900 and 2100");
    }
  });

  it("datas que não existem continuam a ser recusadas", () => {
    expect(fieldError(createTaskSchema.safeParse({ title: "Ok", dueDate: "2026-02-31" }), "dueDate")).toBe("Not a real date");
    expect(fieldError(createTaskSchema.safeParse({ title: "Ok", dueDate: "2027-02-29" }), "dueDate")).toBe("Not a real date");
  });
});

describe("email", () => {
  it("tem no máximo 254 caracteres", () => {
    const long = `${"a".repeat(64)}@${"b".repeat(200)}.com`;
    expect(fieldError(loginSchema.safeParse({ email: long, password: "x", portal: "student" }), "email")).toBe("Max 254 characters");
    expect(fieldError(createStudentSchema.safeParse({ ...student, email: long }), "email")).toBe("Max 254 characters");
    expect(createStudentSchema.safeParse(student).success).toBe(true);
  });
});
