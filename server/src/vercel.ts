// Entrada da API na Vercel (uma Vercel Function em Node). O scripts/build-vercel.ts
// junta este ficheiro e as dependências num só bundle. Só usa Postgres (Neon): o PGlite
// não entra no bundle.
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app.ts";
import { configFromEnv } from "./config.ts";
import { createPostgresDb } from "./db/postgres.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

// Poucas ligações por instância: numa função serverless há muitas instâncias pequenas.
const { db } = createPostgresDb(databaseUrl, { maxConnections: 3 });

const app = createApp(
  configFromEnv(process.env, {
    db,
    // Na Vercel é sempre HTTPS.
    secureCookies: true,
    // A Vercel reescreve o x-forwarded-for com o IP real do cliente.
    trustProxy: true,
    allowCron: true,
  }),
);

// Handler Node (req, res): a Vercel chama-o por cada pedido a /api/*.
export default getRequestListener(app.fetch);
