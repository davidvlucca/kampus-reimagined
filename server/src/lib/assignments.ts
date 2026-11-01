import type { StaffRef } from "@kampus/shared";
import { alias } from "drizzle-orm/pg-core";
import { users } from "../db/schema.ts";

// Quem criou uma tarefa da turma. Um alias de `users` para poder juntar a mesma tabela
// duas vezes (autor e alunos) na mesma consulta.
export const creator = alias(users, "creator");

/** Só as colunas públicas do autor: password_hash nunca entra na consulta. */
export const creatorColumns = {
  id: creator.id,
  firstName: creator.firstName,
  lastName: creator.lastName,
  staffTitle: creator.staffTitle,
};

type CreatorColumns = { id: string; firstName: string; lastName: string; staffTitle: string | null };

/** null quando a pessoa do staff já não existe (created_by ficou a null). */
export function toStaffRef(row: CreatorColumns | null): StaffRef | null {
  return row ? { id: row.id, firstName: row.firstName, lastName: row.lastName, title: row.staffTitle } : null;
}
