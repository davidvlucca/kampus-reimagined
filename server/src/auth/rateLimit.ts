import { createHash } from "node:crypto";
import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { loginAttempts } from "../db/schema.ts";

export const LOGIN_LIMIT = { maxAttempts: 5, windowMs: 15 * 60 * 1000 } as const;

export function attemptKey(email: string, ip: string): string {
  return createHash("sha256").update(`${email}|${ip}`).digest("hex");
}

/**
 * Quantos segundos faltam até poder tentar outra vez, ou 0 se ainda não chegou ao limite.
 * Conta só as falhas dos últimos 15 minutos para este email+IP.
 */
export async function retryAfterSeconds(db: Db, key: string, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - LOGIN_LIMIT.windowMs);
  const rows = await db
    .select({ at: loginAttempts.attemptedAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.attemptedAt, since)))
    .orderBy(asc(loginAttempts.attemptedAt));
  if (rows.length < LOGIN_LIMIT.maxAttempts) return 0;
  // Libertado quando a falha mais antiga que ainda conta sair da janela.
  const oldest = rows[rows.length - LOGIN_LIMIT.maxAttempts]!.at;
  return Math.max(1, Math.ceil((oldest.getTime() + LOGIN_LIMIT.windowMs - now.getTime()) / 1000));
}

export async function recordFailure(db: Db, key: string, now = new Date()) {
  await db.insert(loginAttempts).values({ key, attemptedAt: now });
  // Limpeza oportunista: falhas com mais de um dia já não servem para nada.
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, sql`now() - interval '1 day'`));
}

/** Login certo: as falhas anteriores deste email+IP deixam de contar. */
export async function clearFailures(db: Db, key: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}
