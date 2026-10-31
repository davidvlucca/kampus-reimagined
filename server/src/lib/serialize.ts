import type { Cohort, PublicUser } from "@kampus/shared";
import type { CohortRow, UserRow } from "../db/schema.ts";

// O ÚNICO sítio onde um utilizador vira JSON. Lista os campos um a um: um campo
// novo na tabela (como password_hash) nunca sai na API sem passar por aqui.
export function toPublicUser(user: UserRow, cohort: CohortRow | null): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    cohort: cohort ? toCohort(cohort) : null,
    staffTitle: user.staffTitle,
    tourCompletedAt: iso(user.tourCompletedAt),
    tourSkippedAt: iso(user.tourSkippedAt),
  };
}

export function toCohort(cohort: Pick<CohortRow, "id" | "name">): Cohort {
  return { id: cohort.id, name: cohort.name };
}

export function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
