import { createHash } from "node:crypto";
import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { loginAttempts } from "../db/schema.ts";

const WINDOW_MS = 15 * 60 * 1000;

export const LOGIN_LIMITS = {
  /** Falhas por email+IP em 15 minutos. Um login certo apaga-as. */
  account: { maxAttempts: 5, windowMs: WINDOW_MS },
  /**
   * Todas as tentativas de um IP em 15 minutos, seja qual for o email e mesmo as certas:
   * cada uma custa um argon2, e sem isto um IP podia ocupar o CPU com emails sempre novos.
   */
  ip: { maxAttempts: 30, windowMs: WINDOW_MS },
} as const;

type Limit = (typeof LOGIN_LIMITS)[keyof typeof LOGIN_LIMITS];

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function attemptKey(email: string, ip: string): string {
  return sha256(`${email}|${ip}`);
}

/** Chave do limite por IP. O prefixo não tem "|", por isso nunca coincide com uma de email+IP. */
export function ipAttemptKey(ip: string): string {
  return sha256(`ip:${ip}`);
}

/**
 * Segundos até a chave voltar a ter vaga, ou 0 se a tentativa `ownId` (já gravada) cabe no limite.
 * Conta as linhas dos últimos 15 minutos para esta chave, incluindo a própria tentativa.
 */
async function waitFor(db: Db, key: string, ownId: string, limit: Limit, now: Date): Promise<number> {
  const since = new Date(now.getTime() - limit.windowMs);
  const rows = await db
    .select({ id: loginAttempts.id, at: loginAttempts.attemptedAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.attemptedAt, since)))
    .orderBy(asc(loginAttempts.attemptedAt));
  if (rows.length <= limit.maxAttempts) return 0;
  // A própria tentativa vai ser apagada: há vaga quando a mais antiga das outras que ainda contam sair da janela.
  const others = rows.filter((r) => r.id !== ownId);
  const oldest = others[others.length - limit.maxAttempts]!.at;
  return Math.max(1, Math.ceil((oldest.getTime() + limit.windowMs - now.getTime()) / 1000));
}

/**
 * Reserva uma tentativa de login antes de verificar a password: grava-a primeiro e só
 * depois conta. Assim, pedidos em paralelo (várias instâncias na Vercel) não passam todos
 * pela verificação: cada um vê pelo menos as tentativas gravadas antes da sua, e no máximo
 * `maxAttempts` cabem no limite.
 *
 * Devolve 0 se pode avançar, ou os segundos de espera. Uma tentativa barrada é apagada:
 * não chegou ao argon2, por isso não estende o bloqueio.
 */
export async function claimLoginAttempt(
  db: Db,
  keys: { account: string; ip: string },
  now = new Date(),
): Promise<number> {
  const rows = await db
    .insert(loginAttempts)
    .values([
      { key: keys.ip, attemptedAt: now },
      { key: keys.account, attemptedAt: now },
    ])
    .returning({ id: loginAttempts.id, key: loginAttempts.key });
  const idOf = (key: string) => rows.find((r) => r.key === key)!.id;

  const wait = Math.max(
    await waitFor(db, keys.ip, idOf(keys.ip), LOGIN_LIMITS.ip, now),
    await waitFor(db, keys.account, idOf(keys.account), LOGIN_LIMITS.account, now),
  );
  if (wait > 0) {
    await db.delete(loginAttempts).where(inArray(loginAttempts.id, rows.map((r) => r.id)));
    return wait;
  }
  // Limpeza oportunista: tentativas com mais de um dia já não servem para nada.
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, sql`now() - interval '1 day'`));
  return 0;
}

/**
 * Login certo: as tentativas deste email+IP deixam de contar. As do IP ficam
 * (o limite por IP conta também os logins certos).
 */
export async function clearFailures(db: Db, key: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}
