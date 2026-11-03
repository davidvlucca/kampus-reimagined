import { eq, getTableColumns } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { cohorts, users, type UserRow } from "../db/schema.ts";
import { toPublicUser } from "./serialize.ts";

const { passwordHash: _passwordHash, ...withoutHash } = getTableColumns(users);
/** Todas as colunas de `users` menos o hash: só o login e a mudança de password o leem. */
export const sessionUserColumns = withoutHash;

export async function loadPublicUser(db: Db, userId: string) {
  const [row] = await db
    .select({ user: sessionUserColumns, cohort: cohorts })
    .from(users)
    .leftJoin(cohorts, eq(cohorts.id, users.cohortId))
    .where(eq(users.id, userId))
    .limit(1);
  return row ? toPublicUser(row.user, row.cohort) : null;
}

/** O hash da password de um utilizador (para a confirmar ao mudá-la). */
export async function loadPasswordHash(db: Db, userId: string): Promise<string | undefined> {
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.passwordHash;
}

/** Com o hash: só para o login (e para saber se um email já tem conta). */
export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}
