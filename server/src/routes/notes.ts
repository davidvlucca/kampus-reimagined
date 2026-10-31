import { createNoteSchema, updateNoteSchema, type Note } from "@kampus/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireRole, requireUser } from "../auth/middleware.ts";
import { notes, type NoteRow } from "../db/schema.ts";
import type { AppEnv } from "../lib/env.ts";
import { isUuid } from "../lib/users.ts";
import { validate } from "../lib/validate.ts";

const toNote = (n: NoteRow): Note => ({
  id: n.id,
  title: n.title,
  body: n.body,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

const NOT_FOUND = { error: "Note not found." };

export const noteRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRole("student"))
  .get("/", async (c) => {
    const rows = await c.var.db
      .select()
      .from(notes)
      .where(eq(notes.userId, c.var.user.id))
      .orderBy(desc(notes.updatedAt));
    return c.json({ notes: rows.map(toNote) });
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const [row] = await c.var.db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, c.var.user.id)))
      .limit(1);
    if (!row) return c.json(NOT_FOUND, 404);
    return c.json({ note: toNote(row) });
  })
  .post("/", validate("json", createNoteSchema), async (c) => {
    const { title, body } = c.req.valid("json");
    const [row] = await c.var.db.insert(notes).values({ userId: c.var.user.id, title, body }).returning();
    return c.json({ note: toNote(row!) }, 201);
  })
  .patch("/:id", validate("json", updateNoteSchema), async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const input = c.req.valid("json");
    const [row] = await c.var.db
      .update(notes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, c.var.user.id)))
      .returning();
    if (!row) return c.json(NOT_FOUND, 404);
    return c.json({ note: toNote(row) });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const [row] = await c.var.db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, c.var.user.id)))
      .returning({ id: notes.id });
    if (!row) return c.json(NOT_FOUND, 404);
    return c.body(null, 204);
  });
