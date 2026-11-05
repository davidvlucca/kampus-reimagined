import { changePasswordSchema, DEMO_ACCOUNT_MESSAGES, isProtectedDemoEmail, updateProfileSchema } from "@kampus/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { claimLoginAttempt, ipAttemptKey, reauthAttemptKey, tooManyAttempts } from "../auth/rateLimit.ts";
import { replacePassword } from "../auth/session.ts";
import { users } from "../db/schema.ts";
import type { AppEnv } from "../lib/env.ts";
import { loadPasswordHash, loadPublicUser } from "../lib/users.ts";
import { validate } from "../lib/validate.ts";

const WRONG_CURRENT = { error: "Current password is not correct.", fields: { currentPassword: "Not correct" } };

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
    const db = c.var.db;
    // Confirmar a password atual é um argon2 como o do login: com sessão, sem limite, dava
    // para testar passwords à vontade. Usa os mesmos limites e o mesmo 429, antes do argon2.
    const claim = await claimLoginAttempt(db, { account: reauthAttemptKey(user.id), ip: ipAttemptKey(c.var.clientIp) });
    if (claim.wait > 0) return tooManyAttempts(c, claim.wait);
    // O hash não vem na sessão: lê-se só aqui.
    const passwordHash = await loadPasswordHash(db, user.id);
    if (!passwordHash || !(await verifyPassword(passwordHash, currentPassword))) return c.json(WRONG_CURRENT, 400);
    // Hash novo fora da transação (argon2 é lento); a troca e o fim das outras sessões vão juntos.
    const result = await replacePassword(db, {
      userId: user.id,
      verifiedHash: passwordHash,
      newHash: await hashPassword(newPassword),
      keepSessionId: c.var.sessionId,
    });
    // A password mudou entretanto (outra mudança, ou o staff): a que foi confirmada já não é a atual.
    if (result === "stale") return c.json(WRONG_CURRENT, 400);
    if (result === "no-session") return c.json({ error: "Please log in." }, 401);
    await claim.succeeded();
    return c.body(null, 204);
  });
