import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Db } from "../db/client.ts";
import { sessions, users, type SessionUser } from "../db/schema.ts";
import { sessionUserColumns } from "../lib/users.ts";

const SESSION_COOKIE = "kampus_session";

export interface SessionConfig {
  ttlDays: number;
  secureCookies: boolean;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Cria a sessão na BD e devolve o token que vai no cookie. */
export async function createSession(db: Db, userId: string, config: SessionConfig) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.ttlDays * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  // Limpeza oportunista: as sessões expiradas já não deixam entrar, só ocupam espaço.
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return { token, expiresAt };
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date, config: SessionConfig) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.secureCookies,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/**
 * Lê o cookie e devolve o utilizador e o id da sessão, se a sessão for válida. Corre em
 * todos os pedidos: traz o utilizador sem o hash da password.
 */
export async function readSession(
  db: Db,
  c: Context,
): Promise<{ user: SessionUser; sessionId: string } | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const id = sha256(token);
  const [row] = await db
    .select({ user: sessionUserColumns, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(db: Db, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Depois de mudar a password, termina todas as outras sessões do utilizador. */
export async function deleteOtherSessions(db: Db, userId: string, keepSessionId: string) {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
}
