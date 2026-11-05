import { createHash } from "node:crypto";
import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { Db } from "../db/client.ts";
import { loginAttempts } from "../db/schema.ts";

const WINDOW_MS = 15 * 60 * 1000;

const LOGIN_LIMITS = {
  /** Falhas por email+IP em 15 minutos. Um login certo apaga-as. */
  account: { maxAttempts: 5, windowMs: WINDOW_MS },
  /**
   * Falhas de um IP em 15 minutos, seja qual for o email: sem isto um IP podia testar emails
   * sempre novos. Os logins certos não contam: numa sala com um só IP (escritório, turma),
   * várias pessoas a abrir a demo não bloqueiam as outras.
   */
  ip: { maxAttempts: 30, windowMs: WINDOW_MS },
  /**
   * Logins certos de um IP em 15 minutos. A password da demo é pública e cada login custa um
   * argon2 e uma sessão nova: um teto largo para um script, que uma sala nunca atinge.
   */
  ipSuccesses: { maxAttempts: 200, windowMs: WINDOW_MS },
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
 * Chave das confirmações da password atual (mudar password) de uma conta, seja qual for o IP.
 * Quem chega aqui já tem sessão nesta conta, por isso o limite por conta não deixa ninguém
 * bloquear a conta de outro. Prefixo próprio: não coincide com as chaves do login.
 */
export function reauthAttemptKey(userId: string): string {
  return sha256(`reauth:${userId}`);
}

/** Chave dos logins certos de um IP (a partir da chave do IP, com outro prefixo). */
export function ipSuccessKey(ipKey: string): string {
  return sha256(`ok:${ipKey}`);
}

/**
 * Segundos até a chave voltar a ter vaga, ou 0 se há vaga. Conta as linhas dos últimos 15
 * minutos para esta chave, menos a própria tentativa `ownId` (se já foi gravada).
 */
async function waitFor(db: Db, key: string, ownId: string | null, limit: Limit, now: Date): Promise<number> {
  const since = new Date(now.getTime() - limit.windowMs);
  const rows = await db
    .select({ id: loginAttempts.id, at: loginAttempts.attemptedAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.attemptedAt, since)))
    .orderBy(asc(loginAttempts.attemptedAt));
  const others = rows.filter((r) => r.id !== ownId);
  if (others.length < limit.maxAttempts) return 0;
  // Há vaga quando a mais antiga das que ainda contam sair da janela.
  const oldest = others[others.length - limit.maxAttempts]!.at;
  return Math.max(1, Math.ceil((oldest.getTime() + limit.windowMs - now.getTime()) / 1000));
}

export interface LoginClaim {
  /** 0 se pode avançar, ou os segundos de espera (429). */
  wait: number;
  /**
   * A password estava certa: as falhas deste email+IP deixam de contar e esta tentativa sai
   * do limite por IP (passa a contar só para o teto de logins certos).
   */
  succeeded: () => Promise<void>;
}

/**
 * Reserva uma tentativa de login antes de verificar a password: grava-a primeiro e só
 * depois conta. Assim, pedidos em paralelo (várias instâncias na Vercel) não passam todos
 * pela verificação: cada um vê pelo menos as tentativas gravadas antes da sua, e no máximo
 * `maxAttempts` cabem no limite. Enquanto não se sabe se a password está certa, a tentativa
 * conta como falha; só depois de certa é que sai do limite por IP.
 *
 * Uma tentativa barrada é apagada: não chegou ao argon2, por isso não estende o bloqueio.
 */
export async function claimLoginAttempt(db: Db, keys: { account: string; ip: string }, now = new Date()): Promise<LoginClaim> {
  const rows = await db
    .insert(loginAttempts)
    .values([
      { key: keys.ip, attemptedAt: now },
      { key: keys.account, attemptedAt: now },
    ])
    .returning({ id: loginAttempts.id, key: loginAttempts.key });
  const idOf = (key: string) => rows.find((r) => r.key === key)!.id;
  const successKey = ipSuccessKey(keys.ip);

  const wait = Math.max(
    await waitFor(db, keys.ip, idOf(keys.ip), LOGIN_LIMITS.ip, now),
    await waitFor(db, keys.account, idOf(keys.account), LOGIN_LIMITS.account, now),
    await waitFor(db, successKey, null, LOGIN_LIMITS.ipSuccesses, now),
  );
  if (wait > 0) {
    await db.delete(loginAttempts).where(inArray(loginAttempts.id, rows.map((r) => r.id)));
    return { wait, succeeded: async () => {} };
  }
  // Limpeza oportunista: tentativas com mais de um dia já não servem para nada.
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, sql`now() - interval '1 day'`));
  return {
    wait: 0,
    succeeded: async () => {
      await db.delete(loginAttempts).where(eq(loginAttempts.key, keys.account));
      await db.update(loginAttempts).set({ key: successKey }).where(eq(loginAttempts.id, idOf(keys.ip)));
    },
  };
}

/** O 429 do login, com `Retry-After`. A confirmação da password atual responde igual. */
export function tooManyAttempts(c: Context, wait: number) {
  const minutes = Math.ceil(wait / 60);
  c.header("Retry-After", String(wait));
  return c.json({ error: `Too many login attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.` }, 429);
}
