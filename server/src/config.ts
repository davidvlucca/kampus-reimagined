// A configuração da API a partir das variáveis de ambiente, a mesma em dev (index.ts) e na
// Vercel (vercel.ts). Cada variável passa por um esquema Zod que a normaliza: valores em
// falta ou inválidos voltam ao valor por omissão em vez de rebentar no arranque.
import { z } from "zod";
import type { AppConfig } from "./app.ts";
import type { Db } from "./db/client.ts";

export function parseOrigins(value: string | undefined): string[] {
  return (value ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * SESSION_TTL_DAYS: `Number("")` dava 0 (sessões que expiram logo) e lixo dava NaN.
 * Só vale um número positivo até um ano (mais do que isso e a data de expiração podia
 * sair do intervalo de um Date); o resto volta aos 7 dias.
 */
export function parseSessionTtlDays(value: string | undefined): number {
  const days = Number(value);
  return value?.trim() && Number.isFinite(days) && days > 0 && days <= 365 ? days : 7;
}

/** O commit curto (VERCEL_GIT_COMMIT_SHA) ou "dev" fora da Vercel. */
export function appVersion(commitSha: string | undefined): string {
  return commitSha?.trim() ? commitSha.trim().slice(0, 7) : "dev";
}

const envSchema = z.object({
  CORS_ORIGIN: z.string().optional().transform(parseOrigins),
  SESSION_TTL_DAYS: z.string().optional().transform(parseSessionTtlDays),
  // Vazio conta como não definido.
  CRON_SECRET: z.string().optional().transform((value) => value || undefined),
  VERCEL_GIT_COMMIT_SHA: z.string().optional().transform(appVersion),
});

export interface RuntimeOptions {
  db: Db;
  secureCookies: boolean;
  trustProxy?: boolean;
  /** Se o CRON_SECRET liga o /api/cron/reset-demo neste ambiente. */
  allowCron: boolean;
}

export function configFromEnv(env: Record<string, string | undefined>, runtime: RuntimeOptions): AppConfig {
  const vars = envSchema.parse(env);
  return {
    db: runtime.db,
    corsOrigins: vars.CORS_ORIGIN,
    session: { ttlDays: vars.SESSION_TTL_DAYS, secureCookies: runtime.secureCookies },
    cronSecret: runtime.allowCron ? vars.CRON_SECRET : undefined,
    trustProxy: runtime.trustProxy ?? false,
    version: vars.VERCEL_GIT_COMMIT_SHA,
  };
}
