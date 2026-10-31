import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Db } from "./db/client.ts";
import type { SessionConfig } from "./auth/session.ts";
import { resetDatabase, seedDatabase } from "./demo-data.ts";
import type { AppEnv } from "./lib/env.ts";
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
   * repõe os dados de demonstração; sem ele, a rota não existe (404).
   */
  cronSecret?: string;
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp(config: AppConfig) {
  const allowed = (origin: string) => (config.corsOrigins.includes(origin) ? origin : null);

  const api = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set("db", config.db);
      c.set("session", config.session);
      await next();
    })
    .get("/health", (c) => c.json({ ok: true }))
    // A demo é pública e qualquer visitante pode apagar alunos: o Vercel Cron repõe tudo uma vez por dia.
    .get("/cron/reset-demo", async (c) => {
      if (!config.cronSecret) return c.json({ error: "Not found." }, 404);
      if (!sameSecret(c.req.header("authorization") ?? "", `Bearer ${config.cronSecret}`)) {
        return c.json({ error: "Unauthorized." }, 401);
      }
      await resetDatabase(config.db);
      const result = await seedDatabase(config.db);
      return c.json({ ok: true, ...result });
    })
    .route("/auth", authRoutes)
    .route("/me", meRoutes)
    .route("/tasks", taskRoutes)
    .route("/notes", noteRoutes)
    .route("/contacts", contactRoutes)
    .route("/tour", tourRoutes)
    .route("/cohorts", cohortRoutes)
    .route("/staff", staffRoutes);

  return new Hono()
    .use(secureHeaders())
    .use("/api/*", cors({ origin: allowed, credentials: true, allowMethods: ["GET", "POST", "PATCH", "DELETE"] }))
    // Bloqueia formulários de outros sites (o cookie SameSite=Lax já trava a maior parte).
    .use("/api/*", csrf({ origin: (origin) => config.corsOrigins.includes(origin) }))
    .route("/api", api)
    .notFound((c) => c.json({ error: "Not found." }, 404))
    .onError((err, c) => {
      // Erros esperados (ex.: 403 do csrf) mantêm o status, em JSON como o resto da API.
      if (err instanceof HTTPException) return c.json({ error: err.message || "Request refused." }, err.status);
      console.error(err);
      return c.json({ error: "Something went wrong. Please try again." }, 500);
    });
}

export function parseOrigins(value: string | undefined): string[] {
  return (value ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}
