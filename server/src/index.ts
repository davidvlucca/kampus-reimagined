import { serve } from "@hono/node-server";
import { createApp, parseOrigins, parseSessionTtlDays } from "./app.ts";
import { dbFromEnv } from "./db/client.ts";

const handle = dbFromEnv();
// Em PGlite (demo) aplica as migrações ao arrancar; em Postgres/Neon correm à parte (npm run db:migrate).
if (handle.kind === "pglite") await handle.migrate();

const app = createApp({
  db: handle.db,
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  session: {
    ttlDays: parseSessionTtlDays(process.env.SESSION_TTL_DAYS),
    secureCookies: process.env.NODE_ENV === "production",
  },
  // Com CRON_SECRET, GET /api/cron/reset-demo repõe a demo (os testes E2E usam-no). Só com
  // PGlite: um .env tirado da Vercel (DATABASE_URL de produção + CRON_SECRET) não pode pôr
  // a API local a apagar a base de produção.
  cronSecret: handle.kind === "pglite" ? process.env.CRON_SECRET || undefined : undefined,
});

// API_PORT ganha a PORT: em dev, ferramentas que arrancam o Vite também definem PORT.
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Kampus API on http://localhost:${info.port} (${handle.kind})`);
});

const shutdown = async () => {
  server.close();
  await handle.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
