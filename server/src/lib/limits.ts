import { sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "../db/client.ts";

/**
 * Já há `max` linhas (com o filtro `where`)? Conta antes de inserir. Dois pedidos em
 * paralelo podem passar os dois e ficar um ou dois acima do limite; chega para a demo
 * não encher a base, sem precisar de locks.
 */
export async function atLimit(db: Db, table: PgTable, where: SQL | undefined, max: number): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return (row?.n ?? 0) >= max;
}
