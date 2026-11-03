import { COHORT_TASK_MESSAGE, createTaskSchema, LIMITS, limitMessage, TASK_FILTERS, updateTaskSchema, type Task, type TaskFilter } from "@kampus/shared";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireRole, requireUser } from "../auth/middleware.ts";
import type { Db } from "../db/client.ts";
import { assignmentCompletions, assignments, tasks, type SessionUser, type TaskRow } from "../db/schema.ts";
import { creator, creatorColumns, toStaffRef } from "../lib/assignments.ts";
import type { AppEnv } from "../lib/env.ts";
import { atLimit } from "../lib/limits.ts";
import { iso } from "../lib/serialize.ts";
import { isForeignKeyViolation } from "../lib/pgErrors.ts";
import { uuidParam, validate } from "../lib/validate.ts";

const toTask = (t: TaskRow): Task => ({
  id: t.id,
  title: t.title,
  dueDate: t.dueDate,
  done: t.done,
  completedAt: iso(t.completedAt),
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  source: "personal",
  assignedBy: null,
});

const NOT_FOUND = { error: "Task not found." };
const COHORT_TASK = { error: COHORT_TASK_MESSAGE };
const TOO_MANY = { error: limitMessage(LIMITS.tasksPerStudent, "tasks") };

/**
 * Tarefas da turma ATUAL do aluno, no formato de `Task`. "Feita" quer dizer que existe
 * uma linha de conclusão deste aluno. Um aluno sem turma não tem nenhuma.
 */
async function cohortTasks(db: Db, user: Pick<SessionUser, "id" | "cohortId">, opts: { id?: string; status?: TaskFilter } = {}): Promise<Task[]> {
  if (!user.cohortId) return [];
  const rows = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      dueDate: assignments.dueDate,
      createdAt: assignments.createdAt,
      updatedAt: assignments.updatedAt,
      completedAt: assignmentCompletions.completedAt,
      creator: creatorColumns,
    })
    .from(assignments)
    .leftJoin(
      assignmentCompletions,
      and(eq(assignmentCompletions.assignmentId, assignments.id), eq(assignmentCompletions.userId, user.id)),
    )
    .leftJoin(creator, eq(creator.id, assignments.createdBy))
    .where(
      and(
        eq(assignments.cohortId, user.cohortId),
        opts.id ? eq(assignments.id, opts.id) : undefined,
        opts.status === "done" ? isNotNull(assignmentCompletions.userId) : opts.status === "open" ? isNull(assignmentCompletions.userId) : undefined,
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueDate: r.dueDate,
    done: r.completedAt !== null,
    completedAt: iso(r.completedAt),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    source: "cohort",
    assignedBy: toStaffRef(r.creator),
  }));
}

/** Pessoais e da turma numa só lista: por fazer primeiro, depois o prazo mais perto (sem prazo no fim), depois a mais recente. */
function byListOrder(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  // O id só desempata, para a ordem ser sempre a mesma.
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

// As tarefas pessoais filtram sempre por user_id = utilizador da sessão; as da turma, pela
// turma atual do aluno. A tarefa de outro aluno (ou de outra turma) responde 404, como se
// não existisse.
export const taskRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRole("student"))
  .get("/", validate("query", z.object({ status: z.enum(TASK_FILTERS).default("all") })), async (c) => {
    const { status } = c.req.valid("query");
    const mine = eq(tasks.userId, c.var.user.id);
    const where = status === "all" ? mine : and(mine, eq(tasks.done, status === "done"));
    const [rows, fromCohort] = await Promise.all([
      c.var.db.select().from(tasks).where(where),
      cohortTasks(c.var.db, c.var.user, { status }),
    ]);
    return c.json({ tasks: [...rows.map(toTask), ...fromCohort].sort(byListOrder) });
  })
  .post("/", validate("json", createTaskSchema), async (c) => {
    const { title, dueDate } = c.req.valid("json");
    // Só as tarefas pessoais contam: as da turma são do staff.
    if (await atLimit(c.var.db, tasks, eq(tasks.userId, c.var.user.id), LIMITS.tasksPerStudent)) return c.json(TOO_MANY, 409);
    const [row] = await c.var.db
      .insert(tasks)
      .values({ userId: c.var.user.id, title, dueDate: dueDate ?? null })
      .returning();
    return c.json({ task: toTask(row!) }, 201);
  })
  .patch("/:id", uuidParam(NOT_FOUND), validate("json", updateTaskSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const db = c.var.db;
    const user = c.var.user;
    const now = new Date();
    const [row] = await db
      .update(tasks)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.done !== undefined && { done: input.done, completedAt: input.done ? now : null }),
        updatedAt: now,
      })
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .returning();
    if (row) return c.json({ task: toTask(row) });

    // Não é uma tarefa pessoal: pode ser uma tarefa da turma, que o aluno só marca ou desmarca.
    const [cohortTask] = await cohortTasks(db, user, { id });
    if (!cohortTask) return c.json(NOT_FOUND, 404);
    if (input.title !== undefined || input.dueDate !== undefined) return c.json(COHORT_TASK, 403);
    if (input.done === true) {
      try {
        await db.insert(assignmentCompletions).values({ assignmentId: id, userId: user.id }).onConflictDoNothing();
      } catch (error) {
        // O staff apagou a tarefa entre a verificação e o insert.
        if (isForeignKeyViolation(error)) return c.json(NOT_FOUND, 404);
        throw error;
      }
    } else if (input.done === false) {
      await db
        .delete(assignmentCompletions)
        .where(and(eq(assignmentCompletions.assignmentId, id), eq(assignmentCompletions.userId, user.id)));
    }
    const [updated] = await cohortTasks(db, user, { id });
    // Idem, mas depois do insert: a tarefa já não existe.
    if (!updated) return c.json(NOT_FOUND, 404);
    return c.json({ task: updated });
  })
  .delete("/:id", uuidParam(NOT_FOUND), async (c) => {
    const id = c.req.param("id");
    const [row] = await c.var.db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, c.var.user.id)))
      .returning({ id: tasks.id });
    if (row) return c.body(null, 204);
    // Só o staff apaga uma tarefa da turma.
    const [cohortTask] = await cohortTasks(c.var.db, c.var.user, { id });
    if (cohortTask) return c.json(COHORT_TASK, 403);
    return c.json(NOT_FOUND, 404);
  });
