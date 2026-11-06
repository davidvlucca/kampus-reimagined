import type { Cohort } from "@kampus/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup, STAFF, STUDENT_A } from "./helpers.ts";

let t: Awaited<ReturnType<typeof setup>>;
let student: string;
let staff: string;
let cohortId: string;

beforeAll(async () => {
  t = await setup();
  student = await t.login(STUDENT_A, "student");
  staff = await t.login(STAFF, "staff");
  cohortId = (await t.request<{ cohorts: Cohort[] }>("GET", "/api/cohorts", { cookie: staff })).json.cohorts[0]!.id;
});
afterAll(() => t.close());

const NUL = "Read\u0000me";
const newStudent = { firstName: "Ana", lastName: "Silva", email: "ana.silva@example.com", password: "Kampus123" };

describe("texto que o Postgres não aceita dá 400 com o campo, não 500", () => {
  it.each([
    ["POST", "/api/tasks", "student", { title: NUL }, "title"],
    ["POST", "/api/notes", "student", { title: NUL, body: "" }, "title"],
    ["PATCH", "/api/me", "student", { firstName: NUL, lastName: "Costa" }, "firstName"],
    ["POST", "/api/staff/students", "staff", { ...newStudent, lastName: NUL }, "lastName"],
    ["POST", "/api/staff/assignments", "staff", { title: NUL }, "title"],
  ] as const)("NUL em %s %s (%s) → 400 em %s", async (method, path, who, body, field) => {
    const payload = path === "/api/staff/assignments" || path === "/api/staff/students" ? { ...body, cohortId } : body;
    const res = await t.request<{ fields: Record<string, string> }>(method, path, { cookie: who === "staff" ? staff : student, body: payload });
    expect(res.status).toBe(400);
    expect(res.json.fields[field]).toBe("Contains an invalid character");
  });

  it("NUL na pesquisa de alunos → 400", async () => {
    const res = await t.request<{ fields: Record<string, string> }>("GET", "/api/staff/students?q=a%00b", { cookie: staff });
    expect(res.status).toBe(400);
    expect(res.json.fields.q).toBe("Contains an invalid character");
  });

  it("um título só com caracteres invisíveis conta como vazio", async () => {
    const res = await t.request<{ fields: Record<string, string> }>("POST", "/api/tasks", { cookie: student, body: { title: "​‍" } });
    expect(res.status).toBe(400);
    expect(res.json.fields.title).toBe("Required");
  });

  it("um nome com quebra de linha é recusado", async () => {
    const res = await t.request<{ fields: Record<string, string> }>("PATCH", "/api/me", {
      cookie: student,
      body: { firstName: "Diana\nX", lastName: "Costa" },
    });
    expect(res.status).toBe(400);
    expect(res.json.fields.firstName).toBe("Use a single line of text");
  });

  it("um email com mais de 254 caracteres dá 400 (e não 500 no índice único)", async () => {
    const long = `${"a".repeat(64)}@${"b".repeat(2700)}.com`;
    const create = await t.request<{ fields: Record<string, string> }>("POST", "/api/staff/students", {
      cookie: staff,
      body: { ...newStudent, email: long, cohortId },
    });
    expect(create.status).toBe(400);
    expect(create.json.fields.email).toBe("Max 254 characters");
    const login = await t.request("POST", "/api/auth/login", { body: { email: long, password: "x", portal: "student" } });
    expect(login.status).toBe(400);
  });
});
