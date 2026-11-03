import { changePasswordSchema, DEMO_ACCOUNT_MESSAGES, isProtectedDemoEmail, updateProfileSchema } from "@kampus/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { deleteOtherSessions } from "../auth/session.ts";
import { users } from "../db/schema.ts";
import type { AppEnv } from "../lib/env.ts";
import { loadPasswordHash, loadPublicUser } from "../lib/users.ts";
import { validate } from "../lib/validate.ts";

export const meRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .patch("/", validate("json", updateProfileSchema), async (c) => {
    const { firstName, lastName } = c.req.valid("json");
    await c.var.db
      .update(users)
      .set({ firstName, lastName, updatedAt: new Date() })
      .where(eq(users.id, c.var.user.id));
    return c.json({ user: await loadPublicUser(c.var.db, c.var.user.id) });
  })
  .post("/password", validate("json", changePasswordSchema), async (c) => {
    const { currentPassword, newPassword } = c.req.valid("json");
    const user = c.var.user;
    if (isProtectedDemoEmail(user.email)) return c.json({ error: DEMO_ACCOUNT_MESSAGES.ownPassword }, 403);
    // O hash não vem na sessão: lê-se só aqui.
    const passwordHash = await loadPasswordHash(c.var.db, user.id);
    if (!passwordHash || !(await verifyPassword(passwordHash, currentPassword))) {
      return c.json({ error: "Current password is not correct.", fields: { currentPassword: "Not correct" } }, 400);
    }
    await c.var.db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await deleteOtherSessions(c.var.db, user.id, c.var.sessionId);
    return c.body(null, 204);
  });
