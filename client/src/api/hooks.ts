// Todos os pedidos à API passam por estes hooks. Os ecrãs não chamam fetch diretamente.
import type {
  ChangePasswordInput,
  Cohort,
  Contact,
  CreateNoteInput,
  CreateStudentInput,
  CreateTaskInput,
  LoginInput,
  Note,
  PublicUser,
  StaffOverview,
  StudentRow,
  Task,
  TaskFilter,
  UpdateNoteInput,
  UpdateProfileInput,
  UpdateStudentInput,
  UpdateTaskInput,
} from "@kampus/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "./client.ts";

export const keys = {
  me: ["me"] as const,
  tasks: ["tasks"] as const,
  tasksBy: (filter: TaskFilter) => ["tasks", filter] as const,
  notes: ["notes"] as const,
  note: (id: string) => ["notes", id] as const,
  contacts: ["contacts"] as const,
  cohorts: ["cohorts"] as const,
  overview: ["staff", "overview"] as const,
  students: ["staff", "students"] as const,
  studentsBy: (q: string, cohortId: string) => ["staff", "students", q, cohortId] as const,
};

// ---------- Sessão ----------

/** O utilizador da sessão, ou `null` se não houver sessão (401). */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return (await api<{ user: PublicUser }>("/auth/me")).user;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

/** Para ecrãs dentro de RequireAuth: o utilizador já está carregado. */
export function useCurrentUser(): PublicUser {
  const { data } = useMe();
  if (!data) throw new Error("useCurrentUser must be used inside <RequireAuth>");
  return data;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<{ user: PublicUser }>("/auth/login", { method: "POST", body: input }),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<undefined>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api<{ user: PublicUser }>("/me", { method: "PATCH", body: input }),
    onSuccess: ({ user }) => qc.setQueryData(keys.me, user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api<undefined>("/me/password", { method: "POST", body: input }),
  });
}

// ---------- Visita ----------

export function useCompleteTour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ user: PublicUser }>("/tour/complete", { method: "POST" }),
    onSuccess: ({ user }) => qc.setQueryData(keys.me, user),
  });
}

export function useSkipTour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ user: PublicUser }>("/tour/skip", { method: "POST" }),
    onSuccess: ({ user }) => qc.setQueryData(keys.me, user),
  });
}

// ---------- Tarefas ----------

export function useTasks(filter: TaskFilter = "all") {
  return useQuery({
    queryKey: keys.tasksBy(filter),
    queryFn: async () => (await api<{ tasks: Task[] }>(`/tasks?status=${filter}`)).tasks,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => (await api<{ task: Task }>("/tasks", { method: "POST", body: input })).task,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTaskInput & { id: string }) =>
      (await api<{ task: Task }>(`/tasks/${id}`, { method: "PATCH", body: input })).task,
    // Atualiza a caixa logo (otimista) e repõe se a API falhar.
    onMutate: async ({ id, ...input }) => {
      await qc.cancelQueries({ queryKey: keys.tasks });
      const previous = qc.getQueriesData<Task[]>({ queryKey: keys.tasks });
      qc.setQueriesData<Task[]>({ queryKey: keys.tasks }, (list) =>
        list?.map((t) => (t.id === id ? { ...t, ...input, dueDate: input.dueDate === undefined ? t.dueDate : input.dueDate } : t)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => context?.previous.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

// ---------- Notas ----------

export function useNotes() {
  return useQuery({
    queryKey: keys.notes,
    queryFn: async () => (await api<{ notes: Note[] }>("/notes")).notes,
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: keys.note(id ?? ""),
    queryFn: async () => (await api<{ note: Note }>(`/notes/${id}`)).note,
    enabled: Boolean(id),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoteInput) => (await api<{ note: Note }>("/notes", { method: "POST", body: input })).note,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notes }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateNoteInput & { id: string }) =>
      (await api<{ note: Note }>(`/notes/${id}`, { method: "PATCH", body: input })).note,
    onSuccess: (note) => {
      qc.setQueryData(keys.note(note.id), note);
      return qc.invalidateQueries({ queryKey: keys.notes });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notes }),
  });
}

// ---------- Contactos ----------

export function useContacts() {
  return useQuery({
    queryKey: keys.contacts,
    queryFn: async () => (await api<{ contacts: Contact[] }>("/contacts")).contacts,
    staleTime: 5 * 60_000,
  });
}

// ---------- Staff ----------

export function useCohorts() {
  return useQuery({
    queryKey: keys.cohorts,
    queryFn: async () => (await api<{ cohorts: Cohort[] }>("/cohorts")).cohorts,
    staleTime: 5 * 60_000,
  });
}

export function useStaffOverview() {
  return useQuery({ queryKey: keys.overview, queryFn: () => api<StaffOverview>("/staff/overview") });
}

export function useStudents(filters: { q?: string; cohortId?: string } = {}) {
  const q = filters.q?.trim() ?? "";
  const cohortId = filters.cohortId ?? "";
  return useQuery({
    queryKey: keys.studentsBy(q, cohortId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cohortId) params.set("cohortId", cohortId);
      const qs = params.toString();
      return (await api<{ students: StudentRow[] }>(`/staff/students${qs ? `?${qs}` : ""}`)).students;
    },
    placeholderData: (previous) => previous,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStudentInput) =>
      (await api<{ student: StudentRow }>("/staff/students", { method: "POST", body: input })).student,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateStudentInput & { id: string }) =>
      (await api<{ student: StudentRow }>(`/staff/students/${id}`, { method: "PATCH", body: input })).student,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/staff/students/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}
