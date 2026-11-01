import { z } from "zod";

// Regras e tipos partilhados entre a API e o client: a mesma validação dos dois lados.

export const ROLES = ["staff", "student"] as const;
export type Role = (typeof ROLES)[number];

export const PORTALS = ROLES;
export type Portal = Role;

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));
const name = z.string().trim().min(1, "Required").max(60, "Max 60 characters");
export const passwordRule = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "Max 128 characters");

/** Data sem hora, no formato YYYY-MM-DD. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((v) => {
    // Recusa datas que não existem (2026-02-31): o Postgres dava erro 500.
    const [y, m, d] = v.split("-").map(Number);
    const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
    return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d;
  }, "Not a real date");

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

// ---------- Tarefas ----------

export const TASK_FILTERS = ["all", "open", "done"] as const;
export type TaskFilter = (typeof TASK_FILTERS)[number];

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Required").max(120, "Max 120 characters"),
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

const taskTitle = z.string().trim().min(1, "Required").max(120, "Max 120 characters");

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
  title: z.string().trim().min(1, "Required").max(120, "Max 120 characters"),
  body: z.string().max(10_000, "Max 10 000 characters"),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = createNoteSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

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
  q: z.string().trim().max(100).optional(),
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
}

export type ActivityKind = "login" | "tour_completed" | "student_created";

export interface ActivityItem {
  kind: ActivityKind;
  at: string;
  student: { id: string; firstName: string; lastName: string };
}

export interface StaffOverview {
  totalStudents: number;
  byCohort: { cohort: Cohort; students: number; tourDone: number }[];
  pendingTour: { id: string; firstName: string; lastName: string; cohort: Cohort | null }[];
  recentActivity: ActivityItem[];
}

// ---------- Erros ----------

export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}
