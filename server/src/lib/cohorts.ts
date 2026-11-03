import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { cohorts, users } from "../db/schema.ts";

/** Filtro dos utilizadores que são alunos. */
export const isStudent = eq(users.role, "student");

/** Turma que não existe (apagada noutro separador, ou um id inventado). A mesma mensagem do Zod. */
export const UNKNOWN_COHORT = { error: "Please check the highlighted fields.", fields: { cohortId: "Choose a cohort" } };

export async function cohortExists(db: Db, id: string) {
  const [row] = await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.id, id)).limit(1);
  return Boolean(row);
}
