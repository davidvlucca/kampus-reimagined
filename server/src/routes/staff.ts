import {
  createStudentSchema,
  DEMO_ACCOUNT_MESSAGES,
  isProtectedDemoEmail,
  LIMITS,
  limitMessage,
  studentQuerySchema,
  updateStudentSchema,
  type ActivityItem,
  type StaffOverview,
  type StudentRow,
} from "@kampus/shared";
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { requireRole, requireUser } from "../auth/middleware.ts";
import { hashPassword } from "../auth/password.ts";
import type { Db } from "../db/client.ts";
import { assignmentCompletions, assignments, cohorts, notes, sessions, tasks, users } from "../db/schema.ts";
import type { AppEnv } from "../lib/env.ts";
import { atLimit } from "../lib/limits.ts";
import { iso, toCohort } from "../lib/serialize.ts";
import { findUserByEmail, isUuid } from "../lib/users.ts";
import { validate } from "../lib/validate.ts";

const NOT_FOUND = { error: "Student not found." };
const TOO_MANY = { error: limitMessage(LIMITS.students, "students") };
const EMAIL_TAKEN = { error: "This email already has an account.", fields: { email: "Already in use" } };

const isStudent = eq(users.role, "student");

/** Atividade recente: quantos eventos (visitas, alunos novos) e de quanto tempo os logins. */
const RECENT_EVENTS = 10;
const RECENT_LOGINS_MS = 48 * 60 * 60 * 1000;

async function listStudents(db: Db, where: SQL | undefined): Promise<StudentRow[]> {
  const taskCounts = db
    .select({
      userId: tasks.userId,
      total: sql<number>`count(*)::int`.as("total"),
      done: sql<number>`count(*) filter (where ${tasks.done})::int`.as("done"),
    })
    .from(tasks)
    .groupBy(tasks.userId)
    .as("task_counts");
  // Tarefas da turma: contam as da turma ATUAL do aluno, e as conclusões só dessas.
  const cohortTaskCounts = db
    .select({ cohortId: assignments.cohortId, total: sql<number>`count(*)::int`.as("cohort_total") })
    .from(assignments)
    .groupBy(assignments.cohortId)
    .as("cohort_task_counts");
  const cohortDoneCounts = db
    .select({ userId: assignmentCompletions.userId, done: sql<number>`count(*)::int`.as("cohort_done") })
    .from(assignmentCompletions)
    .innerJoin(assignments, eq(assignments.id, assignmentCompletions.assignmentId))
    .innerJoin(users, and(eq(users.id, assignmentCompletions.userId), eq(users.cohortId, assignments.cohortId)))
    .groupBy(assignmentCompletions.userId)
    .as("cohort_done_counts");
  const noteCounts = db
    .select({ userId: notes.userId, total: sql<number>`count(*)::int`.as("note_total") })
    .from(notes)
    .groupBy(notes.userId)
    .as("note_counts");

  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      cohortId: cohorts.id,
      cohortName: cohorts.name,
      tourCompletedAt: users.tourCompletedAt,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      taskCount: taskCounts.total,
      doneTaskCount: taskCounts.done,
      cohortTaskCount: cohortTaskCounts.total,
      cohortDoneCount: cohortDoneCounts.done,
      noteCount: noteCounts.total,
    })
    .from(users)
    .leftJoin(cohorts, eq(cohorts.id, users.cohortId))
    .leftJoin(taskCounts, eq(taskCounts.userId, users.id))
    .leftJoin(cohortTaskCounts, eq(cohortTaskCounts.cohortId, users.cohortId))
    .leftJoin(cohortDoneCounts, eq(cohortDoneCounts.userId, users.id))
    .leftJoin(noteCounts, eq(noteCounts.userId, users.id))
    .where(and(isStudent, where))
    .orderBy(asc(users.lastName), asc(users.firstName));

  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    cohort: r.cohortId && r.cohortName ? { id: r.cohortId, name: r.cohortName } : null,
    tourCompletedAt: iso(r.tourCompletedAt),
    lastLoginAt: iso(r.lastLoginAt),
    createdAt: r.createdAt.toISOString(),
    taskCount: (r.taskCount ?? 0) + (r.cohortTaskCount ?? 0),
    doneTaskCount: (r.doneTaskCount ?? 0) + (r.cohortDoneCount ?? 0),
    noteCount: r.noteCount ?? 0,
  }));
}

export async function cohortExists(db: Db, id: string) {
  const [row] = await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.id, id)).limit(1);
  return Boolean(row);
}

/** Violação de UNIQUE (dois pedidos ao mesmo tempo com o mesmo email). */
function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

const UNKNOWN_COHORT = { error: "Please check the highlighted fields.", fields: { cohortId: "Unknown cohort" } };

export const cohortRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRole("staff"))
  .get("/", async (c) => {
    const rows = await c.var.db.select().from(cohorts).orderBy(asc(cohorts.name));
    return c.json({ cohorts: rows.map(toCohort) });
  });

export const staffRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRole("staff"))
  .get("/overview", async (c) => {
    const db = c.var.db;

    const byCohortRows = await db
      .select({
        id: cohorts.id,
        name: cohorts.name,
        students: sql<number>`count(${users.id})::int`,
        tourDone: sql<number>`count(${users.tourCompletedAt})::int`,
      })
      .from(cohorts)
      .leftJoin(users, and(eq(users.cohortId, cohorts.id), isStudent))
      .groupBy(cohorts.id, cohorts.name)
      .orderBy(asc(cohorts.name));

    const pending = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, cohortId: cohorts.id, cohortName: cohorts.name })
      .from(users)
      .leftJoin(cohorts, eq(cohorts.id, users.cohortId))
      .where(and(isStudent, isNull(users.tourCompletedAt)))
      .orderBy(asc(users.lastName), asc(users.firstName));

    // "Atividade recente" sem tabela de eventos, a partir de três colunas: as 10 visitas
    // concluídas e alunos criados mais recentes, mais os logins das últimas 48 horas. Os logins
    // vêm à parte (o client junta-os numa linha por dia): numa manhã de aulas eram os 10 mais
    // recentes e escondiam o resto. Cada aluno só tem o último login, por isso são no máximo
    // tantos quantos alunos.
    const student = { id: users.id, firstName: users.firstName, lastName: users.lastName };
    const loginsSince = new Date(Date.now() - RECENT_LOGINS_MS);
    const [logins, tours, created] = await Promise.all([
      db.select({ ...student, at: users.lastLoginAt }).from(users).where(and(isStudent, gte(users.lastLoginAt, loginsSince))).orderBy(desc(users.lastLoginAt)),
      db.select({ ...student, at: users.tourCompletedAt }).from(users).where(and(isStudent, isNotNull(users.tourCompletedAt))).orderBy(desc(users.tourCompletedAt)).limit(RECENT_EVENTS),
      db.select({ ...student, at: users.createdAt }).from(users).where(isStudent).orderBy(desc(users.createdAt)).limit(RECENT_EVENTS),
    ]);
    const toItems = (kind: ActivityItem["kind"], rows: { id: string; firstName: string; lastName: string; at: Date | null }[]) =>
      rows.flatMap((r) =>
        r.at ? [{ kind, at: r.at.toISOString(), student: { id: r.id, firstName: r.firstName, lastName: r.lastName } }] : [],
      );
    const byNewest = (a: ActivityItem, b: ActivityItem) => b.at.localeCompare(a.at);
    const events = [...toItems("tour_completed", tours), ...toItems("student_created", created)].sort(byNewest).slice(0, RECENT_EVENTS);
    const recentActivity = [...toItems("login", logins), ...events].sort(byNewest);

    const overview: StaffOverview = {
      totalStudents: byCohortRows.reduce((sum, r) => sum + r.students, 0),
      byCohort: byCohortRows.map((r) => ({ cohort: { id: r.id, name: r.name }, students: r.students, tourDone: r.tourDone })),
      pendingTour: pending.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        cohort: p.cohortId && p.cohortName ? { id: p.cohortId, name: p.cohortName } : null,
      })),
      recentActivity,
    };
    return c.json(overview);
  })
  .get("/students", validate("query", studentQuerySchema), async (c) => {
    const { q, cohortId } = c.req.valid("query");
    const filters: SQL[] = [];
    if (cohortId) filters.push(eq(users.cohortId, cohortId));
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      const search = or(
        ilike(users.firstName, like),
        ilike(users.lastName, like),
        ilike(users.email, like),
        ilike(sql`${users.firstName} || ' ' || ${users.lastName}`, like),
      );
      if (search) filters.push(search);
    }
    return c.json({ students: await listStudents(c.var.db, filters.length ? and(...filters) : undefined) });
  })
  .post("/students", validate("json", createStudentSchema), async (c) => {
    const input = c.req.valid("json");
    const db = c.var.db;
    if (await atLimit(db, users, isStudent, LIMITS.students)) return c.json(TOO_MANY, 409);
    if (await findUserByEmail(db, input.email)) return c.json(EMAIL_TAKEN, 409);
    if (!(await cohortExists(db, input.cohortId))) return c.json(UNKNOWN_COHORT, 400);
    const passwordHash = await hashPassword(input.password);
    let row: { id: string } | undefined;
    try {
      [row] = await db
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          role: "student",
          firstName: input.firstName,
          lastName: input.lastName,
          cohortId: input.cohortId,
        })
        .returning({ id: users.id });
    } catch (error) {
      if (isUniqueViolation(error)) return c.json(EMAIL_TAKEN, 409);
      throw error;
    }
    const [student] = await listStudents(db, eq(users.id, row!.id));
    return c.json({ student }, 201);
  })
  .patch("/students/:id", validate("json", updateStudentSchema), async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const input = c.req.valid("json");
    const db = c.var.db;

    // Contas da demo: o nome e a turma podem mudar, o email e a password não.
    if (input.email !== undefined || input.password !== undefined) {
      const [target] = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
      if (target && isProtectedDemoEmail(target.email)) {
        const fields: Record<string, string> = {};
        if (input.email !== undefined) fields.email = "Can't change the demo account's email";
        if (input.password !== undefined) fields.password = "Can't change the demo account's password";
        return c.json({ error: DEMO_ACCOUNT_MESSAGES.credentials, fields }, 403);
      }
    }

    if (input.email) {
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, input.email), ne(users.id, id)))
        .limit(1);
      if (taken) return c.json(EMAIL_TAKEN, 409);
    }
    if (input.cohortId && !(await cohortExists(db, input.cohortId))) return c.json(UNKNOWN_COHORT, 400);

    // Só toca em alunos: um staff com este id responde 404, como um id que não existe.
    const passwordHash = input.password ? await hashPassword(input.password) : undefined;
    let row: { id: string } | undefined;
    try {
      [row] = await db
        .update(users)
        .set({
          ...(input.firstName && { firstName: input.firstName }),
          ...(input.lastName && { lastName: input.lastName }),
          ...(input.email && { email: input.email }),
          ...(input.cohortId && { cohortId: input.cohortId }),
          ...(passwordHash && { passwordHash }),
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, id), isStudent))
        .returning({ id: users.id });
    } catch (error) {
      if (isUniqueViolation(error)) return c.json(EMAIL_TAKEN, 409);
      throw error;
    }
    if (!row) return c.json(NOT_FOUND, 404);
    // Nova password ou novo email: as sessões abertas do aluno deixam de valer.
    if (passwordHash || input.email) await db.delete(sessions).where(eq(sessions.userId, id));
    const [student] = await listStudents(db, eq(users.id, id));
    return c.json({ student });
  })
  .delete("/students/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const [target] = await c.var.db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
    if (target && isProtectedDemoEmail(target.email)) return c.json({ error: DEMO_ACCOUNT_MESSAGES.delete }, 403);
    // Tarefas, notas e sessões do aluno vão em cascata (ON DELETE CASCADE).
    const [row] = await c.var.db
      .delete(users)
      .where(and(eq(users.id, id), isStudent))
      .returning({ id: users.id });
    if (!row) return c.json(NOT_FOUND, 404);
    return c.body(null, 204);
  });
