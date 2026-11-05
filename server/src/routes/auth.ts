import { loginSchema, type WrongPortalError } from "@kampus/shared";
import { Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { burnPasswordCheck, verifyPassword } from "../auth/password.ts";
import { attemptKey, claimLoginAttempt, ipAttemptKey, tooManyAttempts } from "../auth/rateLimit.ts";
import { clearSessionCookie, createSessionIfCurrent, deleteSession, readSession, setSessionCookie } from "../auth/session.ts";
import type { AppEnv } from "../lib/env.ts";
import { findUserByEmail, loadPublicUser } from "../lib/users.ts";
import { validate } from "../lib/validate.ts";

const WRONG_CREDENTIALS = { error: "Wrong email or password." };

export const authRoutes = new Hono<AppEnv>()
  .post("/login", validate("json", loginSchema), async (c) => {
    const { email, password, portal } = c.req.valid("json");
    const db = c.var.db;

    // 0. Limites: 5 falhas por email+IP e 30 falhas por IP em 15 minutos. Vêm antes de tudo,
    //    mesmo de uma password certa. A tentativa fica gravada já aqui (ver claimLoginAttempt).
    const claim = await claimLoginAttempt(db, { account: attemptKey(email, c.var.clientIp), ip: ipAttemptKey(c.var.clientIp) });
    if (claim.wait > 0) return tooManyAttempts(c, claim.wait);

    // 1. Password primeiro. Email inexistente e password errada dão a MESMA resposta,
    //    para não revelar que emails têm conta nem de que tipo são.
    const user = await findUserByEmail(db, email);
    if (!user) {
      await burnPasswordCheck(password);
      return c.json(WRONG_CREDENTIALS, 401);
    }
    if (!(await verifyPassword(user.passwordHash, password))) return c.json(WRONG_CREDENTIALS, 401);

    // 2. Só com a password certa é que dizemos que o portal é o errado.
    if (user.role !== portal) {
      await claim.succeeded();
      const body: WrongPortalError = {
        error: user.role === "student" ? "This is a student account." : "This is a staff account.",
        correctPortal: user.role,
      };
      return c.json(body, 403);
    }

    // 3. A password pode ter mudado durante o argon2: a sessão só nasce se o hash verificado
    //    ainda for o atual. Se não for, é uma password errada e a tentativa conta como falha.
    const session = await createSessionIfCurrent(db, user, c.var.session);
    if (!session) return c.json(WRONG_CREDENTIALS, 401);
    await claim.succeeded();
    setSessionCookie(c, session.token, session.expiresAt, c.var.session);
    return c.json({ user: await loadPublicUser(db, user.id) });
  })
  .post("/logout", requireUser, async (c) => {
    await deleteSession(c.var.db, c.var.sessionId);
    clearSessionCookie(c);
    return c.body(null, 204);
  })
  // Sem sessão é 200 com `user: null`, não 401: as páginas públicas perguntam sempre quem
  // está ligado, e um 401 em cada visita era um erro vermelho na consola sem haver erro.
  .get("/me", async (c) => {
    const session = await readSession(c.var.db, c);
    return c.json({ user: session ? await loadPublicUser(c.var.db, session.user.id) : null });
  });
