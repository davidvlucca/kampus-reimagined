// Todos os pedidos à API passam por estes hooks. Os ecrãs não chamam fetch diretamente.
import type {
  Assignment,
  ChangePasswordInput,
  Cohort,
  Contact,
  CreateAssignmentInput,
  CreateNoteInput,
  CreateStudentInput,
  CreateTaskInput,
  KeptNoteResponse,
  LoginInput,
  Note,
  PublicUser,
  StaffOverview,
  StudentRow,
  Task,
  TaskFilter,
  UpdateAssignmentInput,
  UpdateNoteInput,
  UpdateProfileInput,
  UpdateStudentInput,
  UpdateTaskInput,
} from "@kampus/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearUserDrafts } from "../features/student/noteDraft.ts";
import { api, isNotFound, unexpectedResponse } from "./client.ts";

// Um 404 numa mutation quer dizer que a linha já não existe (apagada noutro separador ou
// por outra pessoa): cada hook volta a pedir a lista, para ela deixar de aparecer.

export const keys = {
  me: ["me"] as const,
  /** `true` depois de um "Log out": o RequireAuth leva ao login sem "Please log in to continue". */
  signedOut: ["signedOut"] as const,
  tasks: ["tasks"] as const,
  tasksBy: (filter: TaskFilter) => ["tasks", filter] as const,
  notes: ["notes"] as const,
  note: (id: string) => ["notes", id] as const,
  contacts: ["contacts"] as const,
  cohorts: ["cohorts"] as const,
  overview: ["staff", "overview"] as const,
  students: ["staff", "students"] as const,
  studentsBy: (q: string, cohortId: string) => ["staff", "students", q, cohortId] as const,
  assignments: ["staff", "assignments"] as const,
  assignmentsBy: (cohortId: string) => ["staff", "assignments", "list", cohortId] as const,
};

// ---------- Sessão ----------

/**
 * O utilizador da sessão, ou `null` se não houver sessão (a API responde 200 com `user: null`).
 * Um 401 de outro pedido quer dizer que a sessão caiu a meio: ver o onSessionLost do main.tsx.
 */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      const { user } = await api<{ user?: PublicUser | null }>("/auth/me");
      if (user === undefined) throw unexpectedResponse();
      return user;
    },
    staleTime: 60_000,
  });
}

// Vem do RequireAuth (contexto), não da cache: ver currentUser.ts.
export { useCurrentUser } from "./currentUser.ts";

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
    // Só com sucesso: se o pedido falhar (offline), a sessão continua válida no servidor.
    onSuccess: () => {
      // Os rascunhos de notas de quem saiu não ficam no separador para o próximo utilizador.
      const me = qc.getQueryData<PublicUser | null>(keys.me);
      if (me) clearUserDrafts(me.id);
      qc.clear();
      qc.setQueryData(keys.signedOut, true);
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
    onError: (error) => isNotFound(error) && qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

// ---------- Notas ----------

export function useNotes() {
  return useQuery({
    queryKey: keys.notes,
    queryFn: async () => (await api<{ notes: Note[] }>("/notes")).notes,
    // Gravar já não volta a pedir a lista: o que outro separador mudou chega ao voltar a este.
    refetchOnWindowFocus: true,
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
    onSuccess: async (note) => {
      qc.setQueryData(keys.note(note.id), note);
      // Só a cache: voltar a pedir a lista a cada gravação automática descarregava todas as notas, com o texto todo.
      // A editada passa para cima, como no servidor (por data de edição).
      // Com um pedido da lista a meio (podia chegar depois, com a nota antiga), pede-se outra vez.
      // Cancela-se primeiro: sem lista em cache, o invalidate reaproveitava o pedido que já ia a caminho.
      if (qc.isFetching({ queryKey: keys.notes, exact: true })) {
        await qc.cancelQueries({ queryKey: keys.notes, exact: true });
        return qc.invalidateQueries({ queryKey: keys.notes, exact: true });
      }
      qc.setQueryData<Note[]>(keys.notes, (list) => list && [note, ...list.filter((n) => n.id !== note.id)]);
    },
    // A nota e a lista: o editor passa a mostrar "Note not found".
    onError: (error) => isNotFound(error) && qc.invalidateQueries({ queryKey: keys.notes }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/notes/${id}`, { method: "DELETE" }),
    // Só a lista: invalidar ["notes"] inteiro voltava a pedir a nota apagada (404 no ecrã).
    onSuccess: (_data, id) => {
      qc.setQueryData<Note[]>(keys.notes, (list) => list?.filter((n) => n.id !== id));
      return qc.invalidateQueries({ queryKey: keys.notes, exact: true });
    },
    // Já tinha sido apagada: para a lista é o mesmo que apagar agora.
    onError: (error, id) => {
      if (!isNotFound(error)) return;
      qc.setQueryData<Note[]>(keys.notes, (list) => list?.filter((n) => n.id !== id));
      return qc.invalidateQueries({ queryKey: keys.notes, exact: true });
    },
  });
}

/**
 * A limpeza automática de uma nota nova vazia (ver o NoteForm). O servidor só a apaga se ainda
 * estiver como foi criada: se outro separador já lhe escreveu, fica e vem na resposta. Só se tira
 * da cache depois de o servidor confirmar, para a lista nunca esconder uma nota que ficou.
 */
export function useDiscardEmptyNote() {
  const qc = useQueryClient();
  const drop = (id: string) => {
    qc.setQueryData<Note[]>(keys.notes, (list) => list?.filter((n) => n.id !== id));
    return qc.invalidateQueries({ queryKey: keys.notes, exact: true });
  };
  return useMutation({
    mutationFn: (id: string) => api<KeptNoteResponse | undefined>(`/notes/${id}?onlyIfEmpty=1`, { method: "DELETE" }),
    onSuccess: (kept, id) => {
      if (!kept) return drop(id);
      qc.setQueryData(keys.note(id), kept.note);
      return qc.invalidateQueries({ queryKey: keys.notes, exact: true });
    },
    onError: (error, id) => (isNotFound(error) ? drop(id) : undefined),
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

/** Um 200 com outra forma (proxy, versão antiga da API) dá um ErrorState em vez de rebentar no render. */
function isStaffOverview(data: unknown): data is StaffOverview {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return typeof o.totalStudents === "number" && Array.isArray(o.byCohort) && Array.isArray(o.pendingTour) && Array.isArray(o.recentActivity);
}

export function useStaffOverview() {
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => {
      const data = await api<unknown>("/staff/overview");
      if (!isStaffOverview(data)) throw unexpectedResponse();
      return data;
    },
  });
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
    onError: (error) => isNotFound(error) && qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/staff/students/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
    onError: (error) => isNotFound(error) && qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

// ---------- Staff: tarefas da turma ----------

export function useAssignments(cohortId?: string) {
  const id = cohortId ?? "";
  return useQuery({
    queryKey: keys.assignmentsBy(id),
    queryFn: async () =>
      (await api<{ assignments: Assignment[] }>(`/staff/assignments${id ? `?cohortId=${encodeURIComponent(id)}` : ""}`)).assignments,
    placeholderData: (previous) => previous,
    // O progresso muda quando os alunos marcam tarefas: volta a pedir ao regressar à janela.
    refetchOnWindowFocus: true,
  });
}

// Mudar tarefas da turma muda as contagens de tarefas dos alunos (lista e overview): invalida o staff todo.
export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAssignmentInput) =>
      (await api<{ assignment: Assignment }>("/staff/assignments", { method: "POST", body: input })).assignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAssignmentInput & { id: string }) =>
      (await api<{ assignment: Assignment }>(`/staff/assignments/${id}`, { method: "PATCH", body: input })).assignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.assignments }),
    onError: (error) => isNotFound(error) && qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/staff/assignments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
    onError: (error) => isNotFound(error) && qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}
