import { z } from "zod";
import { isDateKey } from "./dates.ts";

// Regras e tipos partilhados entre a API e o client: a mesma validação dos dois lados.

export const ROLES = ["staff", "student"] as const;
export type Role = (typeof ROLES)[number];

export const PORTALS = ROLES;
export type Portal = Role;

// O Postgres não guarda o carácter NUL num texto (dava erro 500): recusa-se logo aqui.
const noNul = (v: string) => !v.includes("\u0000");
const NUL_MESSAGE = "Contains an invalid character";
// Caracteres que não se veem (zero-width, word joiner, BOM): um título só com eles ficava em branco.
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;
// Caracteres de controlo, incluindo \n e \r: um título ou um nome é uma linha só.
// eslint-disable-next-line no-control-regex -- é mesmo para apanhar caracteres de controlo
const CONTROL = /[\u0000-\u001F\u007F]/;

/**
 * Texto obrigatório de uma linha (títulos, nomes). Uma quebra de linha é recusada,
 * não convertida: os campos do client são de uma linha, por isso só chega por API.
 * Um tab chega por colar texto de uma folha de cálculo: vira espaço em vez de dar erro.
 */
const singleLine = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\t/g, " "))
    .pipe(
      z
        .string()
        .trim()
        .min(1, "Required")
        .refine(noNul, NUL_MESSAGE)
        .refine((v) => !CONTROL.test(v), "Use a single line of text")
        .refine((v) => v.replace(INVISIBLE, "").trim().length > 0, "Required")
        .max(max, `Max ${max} characters`),
    );

// 254 é o máximo de um endereço (RFC 5321); um email enorme rebentava o índice único (500).
const email = z.string().trim().toLowerCase().max(254, "Max 254 characters").pipe(z.email("Enter a valid email"));
const name = singleLine(60);
export const passwordRule = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "Max 128 characters");

/** Anos aceites num prazo. O seletor de datas do Chrome aceita um ano de 2 dígitos (0026). */
export const DATE_MIN_YEAR = 1900;
export const DATE_MAX_YEAR = 2100;
/** Os mesmos limites para o `min`/`max` de um `<input type="date">`. */
export const DATE_INPUT_MIN = `${DATE_MIN_YEAR}-01-01`;
export const DATE_INPUT_MAX = `${DATE_MAX_YEAR}-12-31`;

/** Data sem hora, no formato YYYY-MM-DD, entre 1900 e 2100. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((v) => {
    const year = Number(v.slice(0, 4));
    return year >= DATE_MIN_YEAR && year <= DATE_MAX_YEAR;
  }, `Use a date between ${DATE_MIN_YEAR} and ${DATE_MAX_YEAR}`)
  // Recusa datas que não existem (2026-02-31): o Postgres dava erro 500.
  .refine(isDateKey, "Not a real date");

// ---------- Auth e perfil ----------

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Required").max(128),
  portal: z.enum(PORTALS),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({ firstName: name, lastName: name });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Required").max(128),
  newPassword: passwordRule,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  cohort: Cohort | null;
  staffTitle: string | null;
  tourCompletedAt: string | null;
  tourSkippedAt: string | null;
}

/** Corpo do 403 quando a password está certa mas o portal não é o da conta. */
export interface WrongPortalError {
  error: string;
  correctPortal: Portal;
}

// ---------- Turmas ----------

export interface Cohort {
  id: string;
  name: string;
}

/** O mesmo teste de UUID que a API faz aos ids (ex.: o ?cohort= do URL no client). */
export const isUuid = (value: string) => z.uuid().safeParse(value).success;

// ---------- Tarefas ----------

export const TASK_FILTERS = ["all", "open", "done"] as const;
export type TaskFilter = (typeof TASK_FILTERS)[number];

const taskTitle = singleLine(120);

export const createTaskSchema = z.object({
  title: taskTitle,
  dueDate: isoDate.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ done: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Quem do staff criou uma tarefa da turma. */
export interface StaffRef {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
}

/**
 * "personal": criada pelo aluno, que a pode editar e apagar.
 * "cohort": atribuída pelo staff à turma; o aluno só a pode marcar como feita (ou não).
 */
export type TaskSource = "personal" | "cohort";

export interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  source: TaskSource;
  /** Só nas tarefas da turma; null se a pessoa do staff já não existir. */
  assignedBy: StaffRef | null;
}

/** Resposta 403 quando o aluno tenta editar ou apagar uma tarefa da turma. */
export const COHORT_TASK_MESSAGE = "This task was set by staff for your cohort, so you can only mark it as done.";

// ---------- Tarefas da turma (staff) ----------

export const assignmentQuerySchema = z.object({ cohortId: z.uuid().optional() });

export const createAssignmentSchema = z.object({
  cohortId: z.uuid("Choose a cohort"),
  title: taskTitle,
  dueDate: isoDate.nullable().optional(),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

/** A turma não muda depois de criada: muda-se apagando e criando outra. */
export const updateAssignmentSchema = z
  .object({ title: taskTitle, dueDate: isoDate.nullable() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export interface Assignment {
  id: string;
  title: string;
  dueDate: string | null;
  cohort: Cohort;
  createdBy: StaffRef | null;
  createdAt: string;
  updatedAt: string;
  /** Alunos que estão hoje na turma. */
  students: number;
  /** Desses, quantos a marcaram como feita. */
  done: number;
}

export interface AssignmentStudentStatus {
  student: { id: string; firstName: string; lastName: string };
  done: boolean;
  completedAt: string | null;
}

export interface AssignmentDetail extends Assignment {
  /** Um por aluno da turma: primeiro quem ainda não a fez, depois por nome. */
  progress: AssignmentStudentStatus[];
}

// ---------- Notas ----------

export const createNoteSchema = z.object({
  title: singleLine(120),
  // O corpo pode ter várias linhas e ficar vazio; só o NUL é recusado.
  body: z.string().max(10_000, "Max 10 000 characters").refine(noNul, NUL_MESSAGE),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = createNoteSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

/** O título com que o "New note" cria a nota (o servidor usa-o para saber se ficou intocada). */
export const NEW_NOTE_TITLE = "Untitled note";

/**
 * `DELETE /api/notes/:id?onlyIfEmpty=1`: a limpeza automática de uma nota nova que ficou vazia.
 * Só apaga se a nota estiver como foi criada; se outro separador já lhe escreveu, fica.
 */
export const deleteNoteQuerySchema = z.object({ onlyIfEmpty: z.literal("1").optional() });

/** Resposta 200 do DELETE condicional quando a nota não estava vazia e ficou. */
export interface KeptNoteResponse {
  deleted: false;
  note: Note;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Contactos do staff ----------

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  helpsWith: string;
}

// ---------- Staff: gestão de alunos ----------

export const studentQuerySchema = z.object({
  q: z.string().trim().max(100).refine(noNul, NUL_MESSAGE).optional(),
  cohortId: z.uuid().optional(),
});

export const createStudentSchema = z.object({
  firstName: name,
  lastName: name,
  email,
  cohortId: z.uuid("Choose a cohort"),
  password: passwordRule,
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    cohortId: z.uuid("Choose a cohort"),
    /** Opcional: só muda se vier preenchida. */
    password: passwordRule,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  cohort: Cohort | null;
  tourCompletedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  taskCount: number;
  doneTaskCount: number;
  noteCount: number;
  /**
   * As tarefas da turma ATUAL que o aluno já marcou, com a hora. O estado ("Behind", "Ready")
   * e o "on time" calculam-se no browser, com a data local (ver o ADR 8).
   */
  completions: CohortTaskCompletion[];
}

export interface CohortTaskCompletion {
  assignmentId: string;
  completedAt: string;
}

/** Turma vista pelo staff (`GET /api/staff/cohorts`): com a data de início, para a semana e a linha do tempo. */
export interface StaffCohort extends Cohort {
  startsOn: string;
}

export type ActivityKind = "login" | "tour_completed" | "student_created" | "task_completed";

export interface ActivityItem {
  kind: ActivityKind;
  at: string;
  student: { id: string; firstName: string; lastName: string };
  /** A turma atual do aluno (null se não tiver). */
  cohort: Cohort | null;
  /** Só em "task_completed": a tarefa da turma que o aluno marcou. */
  assignment?: { id: string; title: string };
}

export interface StaffOverview {
  totalStudents: number;
  byCohort: { cohort: Cohort; students: number; tourDone: number }[];
  pendingTour: { id: string; firstName: string; lastName: string; cohort: Cohort | null }[];
  recentActivity: ActivityItem[];
}

// ---------- Limites ----------

/**
 * Máximos de linhas: a demo é pública e um visitante podia encher a base (e a lista de notas
 * passar o limite de tamanho de uma resposta da Vercel). `students` conta todos os alunos,
 * os da demo incluídos; `assignments` são as tarefas da turma de todas as turmas.
 */
export const LIMITS = { tasksPerStudent: 200, notesPerStudent: 100, students: 300, assignments: 100 } as const;

/** A mensagem do 409 quando se chega a um limite (ex.: "200 tasks"). */
export const limitMessage = (max: number, things: string) => `You've reached the limit of ${max} ${things}. Delete some to add more.`;

// ---------- Erros ----------

export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}
