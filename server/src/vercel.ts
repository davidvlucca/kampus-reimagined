// Entrada da API na Vercel (uma Vercel Function em Node). O scripts/build-vercel.ts
// junta este ficheiro e as dependências num só bundle. Só usa Postgres (Neon): o PGlite
// não entra no bundle.
import { getRequestListener } from "@hono/node-server";
import { createApp, parseOrigins } from "./app.ts";
import { createPostgresDb } from "./db/postgres.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

// Poucas ligações por instância: numa função serverless há muitas instâncias pequenas.
const { db } = createPostgresDb(databaseUrl, { maxConnections: 3 });

const app = createApp({
  db,
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  // Na Vercel é sempre HTTPS.
  session: { ttlDays: Number(process.env.SESSION_TTL_DAYS ?? 7), secureCookies: true },
  cronSecret: process.env.CRON_SECRET || undefined,
  // A Vercel reescreve o x-forwarded-for com o IP real do cliente.
  trustProxy: true,
});

// Handler Node (req, res): a Vercel chama-o por cada pedido a /api/*.
export default getRequestListener(app.fetch);
