import { sql } from "drizzle-orm";
import { boolean, date, index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["staff", "student"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const cohorts = pgTable("cohorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Guardado sempre em minúsculas (o Zod trata disso antes de chegar aqui).
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    // Só alunos. Apagar uma turma não apaga alunos: ficam sem turma.
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
    // Só staff.
    staffTitle: text("staff_title"),
    staffHelpsWith: text("staff_helps_with"),
    tourCompletedAt: timestamp("tour_completed_at", { withTimezone: true }),
    tourSkippedAt: timestamp("tour_skipped_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("users_role_idx").on(t.role), index("users_cohort_idx").on(t.cohortId)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 do token. O token em claro só existe no cookie do browser.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Tentativas de login, para os limites de server/src/auth/rateLimit.ts (falhas por email+IP,
// falhas por IP e logins certos por IP, em 15 minutos). Fica em Postgres (e não em memória)
// porque na Vercel cada pedido pode cair numa instância diferente. A chave é um sha256
// ("email|ip", "ip:..." ou "ok:..."): não guardamos o email nem o IP em claro.
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.attemptedAt)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Data sem hora: o "X days left" calcula-se no browser com a data local.
    dueDate: date("due_date", { mode: "string" }),
    done: boolean("done").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("tasks_user_idx").on(t.userId)],
);

// Tarefas da turma: o staff cria uma vez por turma e cada aluno marca a sua conclusão.
// Ficam numa tabela à parte (e não copiadas para `tasks` de cada aluno) para haver uma só
// fonte: editar o título ou o prazo chega a todos, e quem entra depois na turma também a vê.
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "cascade" }),
    // Se a pessoa do staff sair, a tarefa fica (sem autor).
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    ...timestamps,
  },
  (t) => [index("assignments_cohort_idx").on(t.cohortId)],
);

// Uma linha por aluno que marcou a tarefa da turma como feita (desmarcar apaga a linha).
export const assignmentCompletions = pgTable(
  "assignment_completions",
  {
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.assignmentId, t.userId] }), index("assignment_completions_user_idx").on(t.userId)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(sql`''`),
    ...timestamps,
  },
  (t) => [index("notes_user_idx").on(t.userId)],
);

export type UserRow = typeof users.$inferSelect;
/** O utilizador sem o hash da password: é o que anda pelos pedidos (c.var.user). */
export type SessionUser = Omit<UserRow, "passwordHash">;
export type CohortRow = typeof cohorts.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
