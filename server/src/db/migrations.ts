import { sql } from "drizzle-orm";
import journal from "../../drizzle/meta/_journal.json" with { type: "json" };
import type { Db } from "./client.ts";

/** A migração mais recente do código: o `when` do journal é o que o Drizzle grava em `created_at`. */
const LATEST = Math.max(...journal.entries.map((entry) => entry.when));

/**
 * Falta aplicar nesta base alguma migração do código? É a mesma conta que o `migrate()` do
 * Drizzle faz. Numa base sem a tabela das migrações a query falha: quem chama trata como base em baixo.
 */
export async function migrationsPending(db: Db): Promise<boolean> {
  const result = (await db.execute(sql`select max(created_at) as at from drizzle.__drizzle_migrations`)) as unknown as {
    rows: { at: string | number | null }[];
  };
  // `created_at` é bigint: o pg devolve-o como texto. Sem linhas, `at` é null e falta tudo.
  return !(Number(result.rows[0]?.at ?? 0) >= LATEST);
}
