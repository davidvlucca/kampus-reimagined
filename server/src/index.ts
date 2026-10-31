import { serve } from "@hono/node-server";
import { createApp, parseOrigins } from "./app.ts";
import { dbFromEnv } from "./db/client.ts";

const handle = dbFromEnv();
// Em PGlite (demo) aplica as migrações ao arrancar; em Postgres/Neon correm à parte (npm run db:migrate).
if (handle.kind === "pglite") await handle.migrate();

const app = createApp({
  db: handle.db,
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  session: {
    ttlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
    secureCookies: process.env.NODE_ENV === "production",
  },
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
