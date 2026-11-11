import { type Cohort, createNoteSchema, LIMITS } from "@kampus/shared";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { staffHashKey } from "../src/auth/rateLimit.ts";
import { assignments, loginAttempts, notes, tasks, users } from "../src/db/schema.ts";
import { setup, STAFF, STUDENT_A, STUDENT_B } from "./helpers.ts";

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

const count = async (table: typeof tasks | typeof notes | typeof users | typeof assignments | typeof loginAttempts, where = sql`true`) => {
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

  it(`${LIMITS.notesPerStudent} notas no tamanho máximo cabem numa resposta da Vercel (4,5 MB)`, async () => {
    const other = await t.login(STUDENT_B, "student");
    // O pior caso aceite: cada carácter ocupa 3 bytes no JSON (U+0800, o 1.º de 3 bytes em UTF-8).
    const body = "\u0800".repeat(10_000);
    const title = "\u0800".repeat(120);
    expect(createNoteSchema.safeParse({ title, body }).success).toBe(true);
    // Um carácter de controlo valia 6 bytes: a API tira-o.
    const bad = await t.request<{ note: { id: string; body: string } }>("POST", "/api/notes", {
      cookie: other,
      body: { title: "x", body: "a\u0001".repeat(10) },
    });
    expect(bad.status).toBe(201);
    expect(bad.json.note.body).toBe("a".repeat(10));

    const userId = await t.userId(STUDENT_B);
    const have = await count(notes, sql`${notes.userId} = ${userId}`);
    await t.db.insert(notes).values(Array.from({ length: LIMITS.notesPerStudent - have }, () => ({ userId, title, body })));
    await t.db.update(notes).set({ title, body }).where(sql`${notes.userId} = ${userId}`);

    const list = await t.request("GET", "/api/notes", { cookie: other });
    expect(list.status).toBe(200);
    expect(Buffer.byteLength(list.text)).toBeLessThan(4_500_000);
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

  it(`o staff define no máximo ${LIMITS.students * 2} passwords por IP em 15 min (cada uma é um argon2)`, async () => {
    // Simula as que já foram feitas, menos uma (mais rápido do que 600 argon2). Nos testes o IP é "unknown".
    const key = staffHashKey("unknown");
    await t.db.insert(loginAttempts).values(Array.from({ length: LIMITS.students * 2 - 1 }, () => ({ key, attemptedAt: new Date() })));
    const id = await t.userId("filler0@example.com");
    const patch = (body: Record<string, string>) => t.request<{ error: string }>("PATCH", `/api/staff/students/${id}`, { cookie: staff, body });

    expect((await patch({ password: "Another123" })).status).toBe(200);
    const over = await patch({ password: "OneTooMany123" });
    expect(over.status).toBe(429);
    expect(Number(over.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(over.json.error).toMatch(/Too many new passwords/);
    // A barrada não fica gravada, e o que não pede argon2 continua a passar.
    expect(await count(loginAttempts, sql`${loginAttempts.key} = ${key}`)).toBe(LIMITS.students * 2);
    expect((await patch({ firstName: "Renamed" })).status).toBe(200);
  });
});
