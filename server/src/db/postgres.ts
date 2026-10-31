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
export function createPostgresDb(databaseUrl: string, options: { maxConnections?: number } = {}) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: options.maxConnections ?? 10 });
  const db: Db = drizzle(pool, { schema });
  return {
    db,
    kind: "postgres" as const,
    migrate: () => migrate(drizzle(pool, { schema }), { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) }),
    close: () => pool.end(),
  };
}
