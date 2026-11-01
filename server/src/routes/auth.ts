import { loginSchema, type WrongPortalError } from "@kampus/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { burnPasswordCheck, verifyPassword } from "../auth/password.ts";
import { attemptKey, claimLoginAttempt, clearFailures, ipAttemptKey } from "../auth/rateLimit.ts";
import { clearSessionCookie, createSession, deleteSession, setSessionCookie } from "../auth/session.ts";
import { users } from "../db/schema.ts";
import type { AppEnv } from "../lib/env.ts";
import { findUserByEmail, loadPublicUser } from "../lib/users.ts";
import { validate } from "../lib/validate.ts";

const WRONG_CREDENTIALS = { error: "Wrong email or password." };

export const authRoutes = new Hono<AppEnv>()
  .post("/login", validate("json", loginSchema), async (c) => {
    const { email, password, portal } = c.req.valid("json");
    const db = c.var.db;

    // 0. Limites: 5 falhas por email+IP e 30 tentativas por IP em 15 minutos. Vêm antes de
    //    tudo, mesmo de uma password certa. A tentativa fica gravada já aqui (ver claimLoginAttempt).
    const key = attemptKey(email, c.var.clientIp);
    const wait = await claimLoginAttempt(db, { account: key, ip: ipAttemptKey(c.var.clientIp) });
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60);
      c.header("Retry-After", String(wait));
      return c.json({ error: `Too many login attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.` }, 429);
    }

    // 1. Password primeiro. Email inexistente e password errada dão a MESMA resposta,
    //    para não revelar que emails têm conta nem de que tipo são.
    const user = await findUserByEmail(db, email);
    if (!user) {
      await burnPasswordCheck(password);
      return c.json(WRONG_CREDENTIALS, 401);
    }
    if (!(await verifyPassword(user.passwordHash, password))) return c.json(WRONG_CREDENTIALS, 401);
    await clearFailures(db, key);

    // 2. Só com a password certa é que dizemos que o portal é o errado.
    if (user.role !== portal) {
      const body: WrongPortalError = {
        error: user.role === "student" ? "This is a student account." : "This is a staff account.",
        correctPortal: user.role,
      };
      return c.json(body, 403);
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const { token, expiresAt } = await createSession(db, user.id, c.var.session);
    setSessionCookie(c, token, expiresAt, c.var.session);
    return c.json({ user: await loadPublicUser(db, user.id) });
  })
  .post("/logout", requireUser, async (c) => {
    await deleteSession(c.var.db, c.var.sessionId);
    clearSessionCookie(c);
    return c.body(null, 204);
  })
  .get("/me", requireUser, async (c) => {
    return c.json({ user: await loadPublicUser(c.var.db, c.var.user.id) });
  });
