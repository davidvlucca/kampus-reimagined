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
    expect(fieldError(createNoteSchema.safeParse({ title: "Ok", body: nul }), "body")).toBe("Contains an invalid character");
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

  it("títulos e nomes são uma linha só: quebras de linha e tabs são recusados", () => {
    for (const bad of ["Line 1\nLine 2", "a\rb", "a\tb"]) {
      expect(fieldError(createTaskSchema.safeParse({ title: bad }), "title")).toBe("Use a single line of text");
      expect(fieldError(updateProfileSchema.safeParse({ firstName: "Ana", lastName: bad }), "lastName")).toBe("Use a single line of text");
    }
    // Uma quebra no fim é só espaço à volta: o trim tira-a.
    expect(createTaskSchema.parse({ title: "Read the guide\n" }).title).toBe("Read the guide");
  });

  it("o corpo da nota pode ter várias linhas", () => {
    expect(createNoteSchema.safeParse({ title: "Day 1", body: "Line 1\nLine 2\r\n\t- item" }).success).toBe(true);
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
