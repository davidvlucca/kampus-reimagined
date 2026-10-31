import { DEMO_ACCOUNT_MESSAGES, type StudentRow } from "@kampus/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup, STAFF, STUDENT_A } from "./helpers.ts";

let t: Awaited<ReturnType<typeof setup>>;
let staff: string;
let demoStudentId: string;
let demoStaffId: string;

beforeAll(async () => {
  t = await setup();
  staff = await t.login(STAFF, "staff");
  demoStudentId = await t.userId(STUDENT_A);
  demoStaffId = await t.userId(STAFF);
});
afterAll(() => t.close());

describe("contas partilhadas da demo", () => {
  it("o staff não apaga a conta de demo do aluno (403 com mensagem)", async () => {
    const res = await t.request<{ error: string }>("DELETE", `/api/staff/students/${demoStudentId}`, { cookie: staff });
    expect(res.status).toBe(403);
    expect(res.json.error).toBe(DEMO_ACCOUNT_MESSAGES.delete);
    expect((await t.request("GET", "/api/auth/me", { cookie: await t.login(STUDENT_A, "student") })).status).toBe(200);
  });

  it("o staff não muda o email nem a password da conta de demo do aluno", async () => {
    const email = await t.request<{ error: string; fields: Record<string, string> }>("PATCH", `/api/staff/students/${demoStudentId}`, {
      cookie: staff,
      body: { email: "hijacked@example.com" },
    });
    expect(email.status).toBe(403);
    expect(email.json.error).toBe(DEMO_ACCOUNT_MESSAGES.credentials);
    expect(email.json.fields.email).toBeTruthy();

    const password = await t.request("PATCH", `/api/staff/students/${demoStudentId}`, { cookie: staff, body: { password: "Hijacked123" } });
    expect(password.status).toBe(403);

    // A password de demo continua a funcionar.
    await t.login(STUDENT_A, "student");
  });

  it("o nome e a turma da conta de demo podem mudar", async () => {
    const res = await t.request<{ student: StudentRow }>("PATCH", `/api/staff/students/${demoStudentId}`, { cookie: staff, body: { firstName: "Diana" } });
    expect(res.status).toBe(200);
  });

  it("a conta de demo do staff também está protegida", async () => {
    expect((await t.request("DELETE", `/api/staff/students/${demoStaffId}`, { cookie: staff })).status).toBe(403);
    expect((await t.request("PATCH", `/api/staff/students/${demoStaffId}`, { cookie: staff, body: { password: "Hijacked123" } })).status).toBe(403);
  });

  it("ninguém muda a password da própria conta de demo", async () => {
    for (const [email, portal] of [[STAFF, "staff"], [STUDENT_A, "student"]] as const) {
      const cookie = await t.login(email, portal);
      const res = await t.request<{ error: string }>("POST", "/api/me/password", {
        cookie,
        body: { currentPassword: "Kampus123", newPassword: "Hijacked123" },
      });
      expect(res.status).toBe(403);
      expect(res.json.error).toBe(DEMO_ACCOUNT_MESSAGES.ownPassword);
      await t.login(email, portal);
    }
  });

  it("os outros alunos continuam a poder ser editados e apagados", async () => {
    const other = await t.userId("tomas.lima@example.com");
    expect((await t.request("PATCH", `/api/staff/students/${other}`, { cookie: staff, body: { password: "NewPass123" } })).status).toBe(200);
    expect((await t.request("DELETE", `/api/staff/students/${other}`, { cookie: staff })).status).toBe(204);
  });
});
