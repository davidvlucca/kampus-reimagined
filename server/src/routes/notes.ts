import { createNoteSchema, deleteNoteQuerySchema, LIMITS, limitMessage, NEW_NOTE_TITLE, updateNoteSchema, type KeptNoteResponse, type Note } from "@kampus/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireRole, requireUser } from "../auth/middleware.ts";
import { notes, type NoteRow } from "../db/schema.ts";
import type { AppEnv } from "../lib/env.ts";
import { atLimit } from "../lib/limits.ts";
import { uuidParam, validate } from "../lib/validate.ts";

const toNote = (n: NoteRow): Note => ({
  id: n.id,
  title: n.title,
  body: n.body,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

const NOT_FOUND = { error: "Note not found." };
const TOO_MANY = { error: limitMessage(LIMITS.notesPerStudent, "notes") };

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
  .get("/:id", uuidParam(NOT_FOUND), async (c) => {
    const id = c.req.param("id");
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
    if (await atLimit(c.var.db, notes, eq(notes.userId, c.var.user.id), LIMITS.notesPerStudent)) return c.json(TOO_MANY, 409);
    const [row] = await c.var.db.insert(notes).values({ userId: c.var.user.id, title, body }).returning();
    return c.json({ note: toNote(row!) }, 201);
  })
  .patch("/:id", uuidParam(NOT_FOUND), validate("json", updateNoteSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const [row] = await c.var.db
      .update(notes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, c.var.user.id)))
      .returning();
    if (!row) return c.json(NOT_FOUND, 404);
    return c.json({ note: toNote(row) });
  })
  .delete("/:id", uuidParam(NOT_FOUND), validate("query", deleteNoteQuerySchema), async (c) => {
    const id = c.req.param("id");
    const mine = and(eq(notes.id, id), eq(notes.userId, c.var.user.id));
    // `onlyIfEmpty`: a limpeza automática de outro separador não pode apagar o que este guardou.
    // A condição vai no próprio DELETE (sem ler antes), para não haver corrida com um PATCH.
    // Intocada = o título e o corpo do "New note" e nunca editada (updated_at = created_at).
    const onlyIfEmpty = c.req.valid("query").onlyIfEmpty === "1";
    const where = onlyIfEmpty
      ? and(mine, eq(notes.title, NEW_NOTE_TITLE), eq(notes.body, ""), eq(notes.updatedAt, notes.createdAt))
      : mine;
    const [row] = await c.var.db.delete(notes).where(where).returning({ id: notes.id });
    if (row) return c.body(null, 204);
    if (onlyIfEmpty) {
      // Não apagou: ou já tem texto (fica, e devolve-se como está) ou não existe/é de outro aluno.
      const [kept] = await c.var.db.select().from(notes).where(mine).limit(1);
      if (kept) return c.json({ deleted: false, note: toNote(kept) } satisfies KeptNoteResponse);
    }
    return c.json(NOT_FOUND, 404);
  });
