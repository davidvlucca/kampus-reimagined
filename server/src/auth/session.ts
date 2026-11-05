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

/**
 * Cria a sessão do login, mas só se as credenciais verificadas ainda forem as atuais. O argon2
 * corre antes e fora de qualquer transação (é lento); aqui só se bloqueia a linha do
 * utilizador e se confirma que o hash e o email não mudaram entretanto. Sem isto, uma
 * mudança ou reposição de password a meio de um login deixava entrar com a password antiga
 * (as sessões já tinham sido apagadas e esta era criada depois). Devolve null se mudaram.
 */
export async function createSessionIfCurrent(
  db: Db,
  verified: { id: string; passwordHash: string; email: string },
  config: SessionConfig,
) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.ttlDays * 24 * 60 * 60 * 1000);
  const created = await db.transaction(async (tx) => {
    const current = await lockUser(tx, verified.id);
    if (!current || current.passwordHash !== verified.passwordHash || current.email !== verified.email) return false;
    await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, verified.id));
    await tx.insert(sessions).values({ id: sha256(token), userId: verified.id, expiresAt });
    return true;
  });
  if (!created) return null;
  // Limpeza oportunista, fora da transação: as sessões expiradas já não deixam entrar, só ocupam espaço.
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return { token, expiresAt };
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Bloqueia a linha do utilizador até ao fim da transação (select ... for update). Quem muda
 * credenciais e quem cria sessões passa por aqui, por isso um espera pelo outro.
 */
export async function lockUser(tx: Tx, userId: string) {
  const [row] = await tx
    .select({ passwordHash: users.passwordHash, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  return row;
}

/**
 * Muda a password e termina as outras sessões numa só transação, com a linha bloqueada: ou
 * acontecem as duas ou nenhuma. Confirma que o hash ainda é o que foi verificado (outra
 * mudança pode ter ganho a corrida) e que a sessão de quem pede ainda existe (uma reposição
 * pelo staff pode tê-la apagado).
 */
export async function replacePassword(
  db: Db,
  input: { userId: string; verifiedHash: string; newHash: string; keepSessionId: string },
): Promise<"ok" | "stale" | "no-session"> {
  return db.transaction(async (tx) => {
    const current = await lockUser(tx, input.userId);
    if (!current || current.passwordHash !== input.verifiedHash) return "stale";
    const [own] = await tx.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, input.keepSessionId));
    if (!own) return "no-session";
    await tx.update(users).set({ passwordHash: input.newHash, updatedAt: new Date() }).where(eq(users.id, input.userId));
    await tx.delete(sessions).where(and(eq(sessions.userId, input.userId), ne(sessions.id, input.keepSessionId)));
    return "ok";
  });
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
