import { timingSafeEqual } from "node:crypto";
import { getConnInfo } from "@hono/node-server/conninfo";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Db } from "./db/client.ts";
import type { SessionConfig } from "./auth/session.ts";
import { resetDemo } from "./demo-data.ts";
import type { AppEnv } from "./lib/env.ts";
import { pgErrorCode } from "./lib/pgErrors.ts";
import { assignmentRoutes } from "./routes/assignments.ts";
import { authRoutes } from "./routes/auth.ts";
import { meRoutes } from "./routes/me.ts";
import { noteRoutes } from "./routes/notes.ts";
import { cohortRoutes, staffRoutes } from "./routes/staff.ts";
import { contactRoutes, tourRoutes } from "./routes/student.ts";
import { taskRoutes } from "./routes/tasks.ts";

export interface AppConfig {
  db: Db;
  /** Origens autorizadas a chamar a API com cookies (vem de CORS_ORIGIN). */
  corsOrigins: string[];
  session: SessionConfig;
  /**
   * Segredo do Vercel Cron (CRON_SECRET). Com ele definido, GET /api/cron/reset-demo
   * repõe os dados de demonstração; sem ele, a rota não existe (404). Um segredo com
   * menos de 32 caracteres conta como não definido: a rota apaga a base inteira.
   */
  cronSecret?: string;
  /**
   * Atrás de um proxy de confiança (Vercel), o IP vem do header x-forwarded-for, que a
   * Vercel reescreve. Sem proxy, um cliente podia inventar esse header: usa-se o socket.
   */
  trustProxy?: boolean;
  /** Versão publicada (o commit curto na Vercel), devolvida pelo /api/health. */
  version?: string;
}

/** O commit curto (VERCEL_GIT_COMMIT_SHA) ou "dev" fora da Vercel. */
export function appVersion(commitSha: string | undefined): string {
  return commitSha?.trim() ? commitSha.trim().slice(0, 7) : "dev";
}

function clientIp(headers: Headers, trustProxy: boolean, socketAddress: () => string | undefined): string {
  if (trustProxy) {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return socketAddress() ?? "unknown";
  } catch {
    // Sem socket (ex.: app.request() nos testes).
    return "unknown";
  }
}

export const MIN_CRON_SECRET_LENGTH = 32;

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * O que se escreve no log quando um pedido dá 500. Nunca o erro inteiro: um erro do
 * Drizzle traz os parâmetros da query (emails, hashes argon2) no campo `params` e na
 * mensagem ("Failed query: ...\nparams: ..."). Fica o nome, a mensagem sem os parâmetros,
 * o código do Postgres e as primeiras linhas da stack.
 */
export function describeError(err: unknown, route: string) {
  const withoutParams = (message: string) => message.split("\nparams:")[0]!.slice(0, 500);
  const error = err instanceof Error ? err : new Error(String(err));
  const cause = error.cause instanceof Error ? error.cause : undefined;
  const code = pgErrorCode(error);
  return {
    route,
    name: error.name,
    message: withoutParams(error.message),
    ...(code === undefined ? {} : { code }),
    ...(cause ? { cause: `${cause.name}: ${withoutParams(cause.message)}` } : {}),
    // Só as linhas "at ...": a primeira linha da stack repete a mensagem inteira.
    stack: (error.stack ?? "")
      .split("\n")
      .filter((line) => line.trimStart().startsWith("at "))
      .slice(0, 5)
      .map((line) => line.trim()),
  };
}

export function createApp(config: AppConfig) {
  const allowed = (origin: string) => (config.corsOrigins.includes(origin) ? origin : null);
  const version = config.version ?? "dev";
  let cronSecret = config.cronSecret;
  if (cronSecret && cronSecret.length < MIN_CRON_SECRET_LENGTH) {
    console.warn(`CRON_SECRET is shorter than ${MIN_CRON_SECRET_LENGTH} characters: /api/cron/reset-demo stays disabled.`);
    cronSecret = undefined;
  }

  const api = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set("db", config.db);
      c.set("session", config.session);
      c.set("clientIp", clientIp(c.req.raw.headers, config.trustProxy ?? false, () => getConnInfo(c).remote.address));
      await next();
    })
    // Vivo: responde sem tocar na base. Pronto: a base também responde.
    .get("/health", (c) => {
      c.header("Cache-Control", "no-store");
      return c.json({ ok: true, version });
    })
    .get("/health/ready", async (c) => {
      c.header("Cache-Control", "no-store");
      try {
        await config.db.execute(sql`select 1`);
        return c.json({ ok: true, version });
      } catch (err) {
        console.error("Health check failed", describeError(err, "GET /api/health/ready"));
        return c.json({ ok: false }, 503);
      }
    })
    // A demo é pública e qualquer visitante pode apagar alunos: o Vercel Cron repõe tudo uma vez por dia.
    .get("/cron/reset-demo", async (c) => {
      if (!cronSecret) return c.json({ error: "Not found." }, 404);
      if (!sameSecret(c.req.header("authorization") ?? "", `Bearer ${cronSecret}`)) {
        return c.json({ error: "Unauthorized." }, 401);
      }
      const result = await resetDemo(config.db);
      return c.json({ ok: true, ...result });
    })
    .route("/auth", authRoutes)
    .route("/me", meRoutes)
    .route("/tasks", taskRoutes)
    .route("/notes", noteRoutes)
    .route("/contacts", contactRoutes)
    .route("/tour", tourRoutes)
    .route("/cohorts", cohortRoutes)
    // Antes de /staff: assim o requireUser não corre duas vezes nestes pedidos.
    .route("/staff/assignments", assignmentRoutes)
    .route("/staff", staffRoutes);

  return new Hono()
    // A API só devolve JSON: a CSP mais fechada possível, e nunca dentro de um iframe.
    .use(
      secureHeaders({
        strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
        xFrameOptions: "DENY",
        contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      }),
    )
    // Respostas com dados de uma sessão não ficam em caches (do browser ou intermédias),
    // a não ser que a rota diga outra coisa.
    .use("/api/*", async (c, next) => {
      await next();
      if (!c.res.headers.has("cache-control")) c.header("Cache-Control", "no-store");
    })
    .use("/api/*", cors({ origin: allowed, credentials: true, allowMethods: ["GET", "POST", "PATCH", "DELETE"] }))
    // Bloqueia formulários de outros sites (o cookie SameSite=Lax já trava a maior parte).
    .use("/api/*", csrf({ origin: (origin) => config.corsOrigins.includes(origin) }))
    .route("/api", api)
    .notFound((c) => c.json({ error: "Not found." }, 404))
    .onError((err, c) => {
      // Erros esperados (ex.: 403 do csrf) mantêm o status, em JSON como o resto da API.
      if (err instanceof HTTPException) return c.json({ error: err.message || "Request refused." }, err.status);
      console.error("API error", describeError(err, `${c.req.method} ${c.req.path}`));
      return c.json({ error: "Something went wrong. Please try again." }, 500);
    });
}

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
