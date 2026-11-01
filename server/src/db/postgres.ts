import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import type { Db } from "./client.ts";
import * as schema from "./schema.ts";

/**
 * Postgres "a sério" (Neon em produção) via node-postgres. Fica num ficheiro à parte
 * para o bundle da Vercel não arrastar o PGlite.
 */
export function createPool(databaseUrl: string, maxConnections = 10) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: maxConnections,
    // Fecha cedo as ligações paradas: o Neon (e o proxy dele) corta as que ficam muito tempo à espera.
    idleTimeoutMillis: 10_000,
  });
  // Uma ligação parada que o Neon fecha emite 'error' no pool. Sem este listener era uma
  // exceção não apanhada e o processo caía; assim o pool deita-a fora e abre outra quando for
  // preciso. Só a mensagem e o código: nada de parâmetros de queries no log.
  pool.on("error", (err: Error & { code?: string }) => {
    console.error("Postgres pool error", { message: err.message, code: err.code });
  });
  return pool;
}

export function createPostgresDb(databaseUrl: string, options: { maxConnections?: number } = {}) {
  const pool = createPool(databaseUrl, options.maxConnections);
  const db: Db = drizzle(pool, { schema });
  return {
    db,
    kind: "postgres" as const,
    migrate: () => migrate(drizzle(pool, { schema }), { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) }),
    close: () => pool.end(),
  };
}
