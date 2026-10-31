import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { cohorts, users, type UserRow } from "../db/schema.ts";
import { toPublicUser } from "./serialize.ts";

export async function loadPublicUser(db: Db, userId: string) {
  const [row] = await db
    .select({ user: users, cohort: cohorts })
    .from(users)
    .leftJoin(cohorts, eq(cohorts.id, users.cohortId))
    .where(eq(users.id, userId))
    .limit(1);
  return row ? toPublicUser(row.user, row.cohort) : null;
}

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Um id que não é UUID nunca existe: responde-se 404 em vez de deixar o Postgres dar erro. */
export const isUuid = (value: string) => UUID.test(value);
