import { createTaskSchema, TASK_FILTERS, updateTaskSchema, type Task } from "@kampus/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireRole, requireUser } from "../auth/middleware.ts";
import { tasks, type TaskRow } from "../db/schema.ts";
import type { AppEnv } from "../lib/env.ts";
import { iso } from "../lib/serialize.ts";
import { isUuid } from "../lib/users.ts";
import { validate } from "../lib/validate.ts";

const toTask = (t: TaskRow): Task => ({
  id: t.id,
  title: t.title,
  dueDate: t.dueDate,
  done: t.done,
  completedAt: iso(t.completedAt),
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});

const NOT_FOUND = { error: "Task not found." };

// Todas as consultas filtram por user_id = utilizador da sessão. A tarefa de outro
// aluno responde 404, como se não existisse.
export const taskRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRole("student"))
  .get("/", validate("query", z.object({ status: z.enum(TASK_FILTERS).default("all") })), async (c) => {
    const { status } = c.req.valid("query");
    const mine = eq(tasks.userId, c.var.user.id);
    const where = status === "all" ? mine : and(mine, eq(tasks.done, status === "done"));
    const rows = await c.var.db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(asc(tasks.done), sql`${tasks.dueDate} asc nulls last`, desc(tasks.createdAt));
    return c.json({ tasks: rows.map(toTask) });
  })
  .post("/", validate("json", createTaskSchema), async (c) => {
    const { title, dueDate } = c.req.valid("json");
    const [row] = await c.var.db
      .insert(tasks)
      .values({ userId: c.var.user.id, title, dueDate: dueDate ?? null })
      .returning();
    return c.json({ task: toTask(row!) }, 201);
  })
  .patch("/:id", validate("json", updateTaskSchema), async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const input = c.req.valid("json");
    const now = new Date();
    const [row] = await c.var.db
      .update(tasks)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.done !== undefined && { done: input.done, completedAt: input.done ? now : null }),
        updatedAt: now,
      })
      .where(and(eq(tasks.id, id), eq(tasks.userId, c.var.user.id)))
      .returning();
    if (!row) return c.json(NOT_FOUND, 404);
    return c.json({ task: toTask(row) });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const [row] = await c.var.db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, c.var.user.id)))
      .returning({ id: tasks.id });
    if (!row) return c.json(NOT_FOUND, 404);
    return c.body(null, 204);
  });
