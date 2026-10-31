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
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

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

export interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
