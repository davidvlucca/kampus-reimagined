import type { Contact } from "@kampus/shared";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireRole, requireUser } from "../auth/middleware.ts";
import { users } from "../db/schema.ts";
import type { AppEnv } from "../lib/env.ts";
import { loadPublicUser } from "../lib/users.ts";

export const contactRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRole("student"))
  .get("/", async (c) => {
    const rows = await c.var.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        title: users.staffTitle,
        helpsWith: users.staffHelpsWith,
      })
      .from(users)
      .where(eq(users.role, "staff"))
      .orderBy(asc(users.createdAt));
    const contacts: Contact[] = rows.map((r) => ({ ...r, title: r.title ?? "Staff", helpsWith: r.helpsWith ?? "" }));
    return c.json({ contacts });
  });

export const tourRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRole("student"))
  .post("/complete", async (c) => {
    const now = new Date();
    await c.var.db.update(users).set({ tourCompletedAt: now, updatedAt: now }).where(eq(users.id, c.var.user.id));
    return c.json({ user: await loadPublicUser(c.var.db, c.var.user.id) });
  })
  .post("/skip", async (c) => {
    const now = new Date();
    await c.var.db.update(users).set({ tourSkippedAt: now, updatedAt: now }).where(eq(users.id, c.var.user.id));
    return c.json({ user: await loadPublicUser(c.var.db, c.var.user.id) });
  });
