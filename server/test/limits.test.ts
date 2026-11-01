import { type Cohort, LIMITS } from "@kampus/shared";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignments, notes, tasks, users } from "../src/db/schema.ts";
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

const count = async (table: typeof tasks | typeof notes | typeof users | typeof assignments, where = sql`true`) => {
  const [row] = await t.db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
  return row!.n;
};

describe("limites de linhas (a demo é pública: ninguém enche a base)", () => {
  it(`um aluno tem no máximo ${LIMITS.tasksPerStudent} tarefas pessoais`, async () => {
    const userId = await t.userId(STUDENT_A);
    const have = await count(tasks, sql`${tasks.userId} = ${userId}`);
    // Enche até faltar uma, direto na base (mais rápido do que pela API).
    await t.db.insert(tasks).values(Array.from({ length: LIMITS.tasksPerStudent - have - 1 }, (_, i) => ({ userId, title: `Filler ${i}` })));

    expect((await t.request("POST", "/api/tasks", { cookie: student, body: { title: "The last one" } })).status).toBe(201);
    const over = await t.request<{ error: string }>("POST", "/api/tasks", { cookie: student, body: { title: "One too many" } });
    expect(over.status).toBe(409);
    expect(over.json.error).toBe(`You've reached the limit of ${LIMITS.tasksPerStudent} tasks. Delete some to add more.`);
    expect(await count(tasks, sql`${tasks.userId} = ${userId}`)).toBe(LIMITS.tasksPerStudent);
  });

  it(`e no máximo ${LIMITS.notesPerStudent} notas`, async () => {
    const userId = await t.userId(STUDENT_A);
    const have = await count(notes, sql`${notes.userId} = ${userId}`);
    await t.db.insert(notes).values(Array.from({ length: LIMITS.notesPerStudent - have }, (_, i) => ({ userId, title: `Filler ${i}`, body: "" })));
    const over = await t.request<{ error: string }>("POST", "/api/notes", { cookie: student, body: { title: "Untitled note", body: "" } });
    expect(over.status).toBe(409);
    expect(over.json.error).toMatch(/limit of 100 notes/);
  });

  it(`a escola tem no máximo ${LIMITS.students} alunos`, async () => {
    const have = await count(users, sql`${users.role} = 'student'`);
    const [{ passwordHash }] = (await t.db.select({ passwordHash: users.passwordHash }).from(users).limit(1)) as [{ passwordHash: string }];
    await t.db.insert(users).values(
      Array.from({ length: LIMITS.students - have }, (_, i) => ({
        email: `filler${i}@example.com`,
        passwordHash,
        role: "student" as const,
        firstName: "Filler",
        lastName: String(i),
        cohortId,
      })),
    );
    const over = await t.request<{ error: string }>("POST", "/api/staff/students", {
      cookie: staff,
      body: { firstName: "Ana", lastName: "Silva", email: "ana.silva@example.com", cohortId, password: "Kampus123" },
    });
    expect(over.status).toBe(409);
    expect(over.json.error).toMatch(/limit of 300 students/);
  });

  it(`e no máximo ${LIMITS.assignments} tarefas da turma`, async () => {
    const have = await count(assignments);
    await t.db.insert(assignments).values(Array.from({ length: LIMITS.assignments - have }, (_, i) => ({ cohortId, title: `Filler ${i}` })));
    const over = await t.request<{ error: string }>("POST", "/api/staff/assignments", { cookie: staff, body: { cohortId, title: "One too many" } });
    expect(over.status).toBe(409);
    expect(over.json.error).toMatch(/limit of 100 cohort tasks/);
  });
});
