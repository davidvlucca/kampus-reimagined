import {
  assignmentQuerySchema,
  createAssignmentSchema,
  LIMITS,
  limitMessage,
  updateAssignmentSchema,
  type Assignment,
  type AssignmentDetail,
} from "@kampus/shared";
import { and, asc, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { requireRole, requireUser } from "../auth/middleware.ts";
import type { Db } from "../db/client.ts";
import { assignmentCompletions, assignments, cohorts, users } from "../db/schema.ts";
import { creator, creatorColumns, toStaffRef } from "../lib/assignments.ts";
import type { AppEnv } from "../lib/env.ts";
import { atLimit } from "../lib/limits.ts";
import { iso, toCohort } from "../lib/serialize.ts";
import { isUuid } from "../lib/users.ts";
import { validate } from "../lib/validate.ts";
import { cohortExists } from "./staff.ts";

// Mesma mensagem que o aluno recebe: para quem usa a app, é tudo "uma tarefa".
const NOT_FOUND = { error: "Task not found." };
const TOO_MANY = { error: limitMessage(LIMITS.assignments, "cohort tasks") };
const UNKNOWN_COHORT = { error: "Please check the highlighted fields.", fields: { cohortId: "Choose a cohort" } };

const isStudent = eq(users.role, "student");

/**
 * As contas são sempre sobre quem está HOJE na turma: um aluno que mudou de turma deixa
 * de contar (e as conclusões que deixou na turma antiga também).
 */
async function listAssignments(db: Db, where: SQL | undefined): Promise<Assignment[]> {
  const studentCounts = db
    .select({ cohortId: users.cohortId, total: sql<number>`count(*)::int`.as("student_total") })
    .from(users)
    .where(and(isStudent, isNotNull(users.cohortId)))
    .groupBy(users.cohortId)
    .as("student_counts");
  const doneCounts = db
    .select({ assignmentId: assignmentCompletions.assignmentId, total: sql<number>`count(*)::int`.as("done_total") })
    .from(assignmentCompletions)
    .innerJoin(assignments, eq(assignments.id, assignmentCompletions.assignmentId))
    .innerJoin(users, and(eq(users.id, assignmentCompletions.userId), eq(users.cohortId, assignments.cohortId), isStudent))
    .groupBy(assignmentCompletions.assignmentId)
    .as("done_counts");

  const rows = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      dueDate: assignments.dueDate,
      cohort: { id: cohorts.id, name: cohorts.name },
      creator: creatorColumns,
      createdAt: assignments.createdAt,
      updatedAt: assignments.updatedAt,
      students: studentCounts.total,
      done: doneCounts.total,
    })
    .from(assignments)
    .innerJoin(cohorts, eq(cohorts.id, assignments.cohortId))
    .leftJoin(creator, eq(creator.id, assignments.createdBy))
    .leftJoin(studentCounts, eq(studentCounts.cohortId, assignments.cohortId))
    .leftJoin(doneCounts, eq(doneCounts.assignmentId, assignments.id))
    .where(where)
    .orderBy(sql`${assignments.dueDate} asc nulls last`, desc(assignments.createdAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueDate: r.dueDate,
    cohort: toCohort(r.cohort),
    createdBy: toStaffRef(r.creator),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    students: r.students ?? 0,
    done: r.done ?? 0,
  }));
}

async function loadDetail(db: Db, id: string): Promise<AssignmentDetail | null> {
  const [assignment] = await listAssignments(db, eq(assignments.id, id));
  if (!assignment) return null;
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      completedAt: assignmentCompletions.completedAt,
    })
    .from(users)
    .leftJoin(assignmentCompletions, and(eq(assignmentCompletions.assignmentId, id), eq(assignmentCompletions.userId, users.id)))
    .where(and(isStudent, eq(users.cohortId, assignment.cohort.id)))
    // Quem ainda não a fez primeiro (false < true), depois por nome.
    .orderBy(sql`${assignmentCompletions.userId} is not null`, asc(users.firstName), asc(users.lastName));
  return {
    ...assignment,
    progress: rows.map((r) => ({
      student: { id: r.id, firstName: r.firstName, lastName: r.lastName },
      done: r.completedAt !== null,
      completedAt: iso(r.completedAt),
    })),
  };
}

export const assignmentRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRole("staff"))
  .get("/", validate("query", assignmentQuerySchema), async (c) => {
    const { cohortId } = c.req.valid("query");
    const where = cohortId ? eq(assignments.cohortId, cohortId) : undefined;
    return c.json({ assignments: await listAssignments(c.var.db, where) });
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const assignment = await loadDetail(c.var.db, id);
    if (!assignment) return c.json(NOT_FOUND, 404);
    return c.json({ assignment });
  })
  .post("/", validate("json", createAssignmentSchema), async (c) => {
    const input = c.req.valid("json");
    const db = c.var.db;
    if (await atLimit(db, assignments, undefined, LIMITS.assignments)) return c.json(TOO_MANY, 409);
    if (!(await cohortExists(db, input.cohortId))) return c.json(UNKNOWN_COHORT, 400);
    const [row] = await db
      .insert(assignments)
      .values({ cohortId: input.cohortId, createdBy: c.var.user.id, title: input.title, dueDate: input.dueDate ?? null })
      .returning({ id: assignments.id });
    const [assignment] = await listAssignments(db, eq(assignments.id, row!.id));
    return c.json({ assignment }, 201);
  })
  .patch("/:id", validate("json", updateAssignmentSchema), async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const input = c.req.valid("json");
    const db = c.var.db;
    const [row] = await db
      .update(assignments)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, id))
      .returning({ id: assignments.id });
    if (!row) return c.json(NOT_FOUND, 404);
    const [assignment] = await listAssignments(db, eq(assignments.id, id));
    return c.json({ assignment });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    // As conclusões dos alunos vão em cascata (ON DELETE CASCADE).
    const [row] = await c.var.db.delete(assignments).where(eq(assignments.id, id)).returning({ id: assignments.id });
    if (!row) return c.json(NOT_FOUND, 404);
    return c.body(null, 204);
  });
