import type { Role } from "@kampus/shared";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/env.ts";
import { readSession } from "./session.ts";

/** 401 sem sessão válida; põe `user` e `sessionId` no contexto. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await readSession(c.var.db, c);
  if (!session) return c.json({ error: "Please log in." }, 401);
  c.set("user", session.user);
  c.set("sessionId", session.sessionId);
  await next();
});

/** 403 se o papel não for o pedido. Usar sempre depois de `requireUser`. */
export const requireRole = (role: Role) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.var.user.role !== role) return c.json({ error: "You don't have access to this." }, 403);
    await next();
  });
