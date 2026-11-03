import type { StaffOverview } from "@kampus/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../src/db/schema.ts";
import { setup, STAFF } from "./helpers.ts";

let t: Awaited<ReturnType<typeof setup>>;
let staff: string;
beforeAll(async () => {
  t = await setup();
  staff = await t.login(STAFF, "staff");
});
afterAll(() => t.close());

const overview = async () => (await t.request<StaffOverview>("GET", "/api/staff/overview", { cookie: staff })).json;

describe("atividade recente do staff", () => {
  it("os logins de uma manhã de aulas não escondem as visitas nem os alunos novos", async () => {
    // Todos os alunos entraram há pouco (mais recentes do que qualquer outro evento).
    await t.db.update(users).set({ lastLoginAt: sql`now() - interval '5 minutes'` }).where(eq(users.role, "student"));
    // Um entrou há 3 dias: já não conta.
    const old = await t.userId("andre.pinto@example.com");
    await t.db.update(users).set({ lastLoginAt: sql`now() - interval '3 days'` }).where(eq(users.id, old));

    // Um aluno criado agora: o evento mais recente que não é um login.
    const { cohorts } = (await t.request<{ cohorts: { id: string }[] }>("GET", "/api/cohorts", { cookie: staff })).json;
    const created = await t.request<{ student: { id: string } }>("POST", "/api/staff/students", {
      cookie: staff,
      body: { firstName: "Nova", lastName: "Aluna", email: "nova.aluna@example.com", cohortId: cohorts[0]!.id, password: "Kampus123" },
    });
    expect(created.status).toBe(201);

    const { recentActivity, totalStudents } = await overview();
    const logins = recentActivity.filter((i) => i.kind === "login");
    const others = recentActivity.filter((i) => i.kind !== "login");

    // Todos menos o de há 3 dias e o aluno novo (que nunca entrou).
    expect(logins).toHaveLength(totalStudents - 2);
    expect(logins.map((i) => i.student.id)).not.toContain(old);
    expect(others).toHaveLength(10);
    expect(others.some((i) => i.kind === "tour_completed")).toBe(true);
    expect(others[0]).toMatchObject({ kind: "student_created", student: { id: created.json.student.id } });
    // Uma lista só, do mais recente para o mais antigo.
    const times = recentActivity.map((i) => i.at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("sem logins nas últimas 48 horas, ficam só os 10 eventos", async () => {
    await t.db.update(users).set({ lastLoginAt: sql`now() - interval '49 hours'` }).where(eq(users.role, "student"));
    const { recentActivity } = await overview();
    expect(recentActivity.filter((i) => i.kind === "login")).toHaveLength(0);
    expect(recentActivity).toHaveLength(10);
  });
});
