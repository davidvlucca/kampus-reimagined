import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Db } from "./db/client.ts";
import type { SessionConfig } from "./auth/session.ts";
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
