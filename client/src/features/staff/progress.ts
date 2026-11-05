import { daysBetween, localDateKey, type Assignment, type StaffCohort, type StudentRow } from "@kampus/shared";

// Regras do staff (dashboard, alunos, tarefas da turma) num sítio só, sem React, para se
// poderem testar. Tudo com a data LOCAL do browser, como os prazos (ver o ADR 8).

/**
 * Estado de um aluno, do mais urgente para o menos:
 * - "not_signed_in": nunca entrou;
 * - "behind": tem pelo menos uma tarefa da turma com o prazo já passado e por fazer;
 * - "ready": fez todas as tarefas da turma (e a turma tem pelo menos uma);
 * - "on_track": o resto (entrou, nada em atraso, ainda há tarefas por fazer ou nenhuma).
 */
export type StudentStatus = "not_signed_in" | "behind" | "on_track" | "ready";

export const STATUS_ORDER: StudentStatus[] = ["not_signed_in", "behind", "on_track", "ready"];

export const STATUS_LABEL: Record<StudentStatus, string> = {
  not_signed_in: "Not signed in",
  behind: "Behind",
  on_track: "On track",
  ready: "Ready",
};

/** O filtro do URL (`?status=`). "nudge" junta os dois que pedem um lembrete. */
export type StatusFilter = "all" | "not-signed-in" | "behind" | "on-track" | "ready" | "nudge";

export const STATUS_PARAM: Record<StudentStatus, StatusFilter> = {
  not_signed_in: "not-signed-in",
  behind: "behind",
  on_track: "on-track",
  ready: "ready",
};

export function statusFilter(param: string | null): StatusFilter {
  const valid: StatusFilter[] = ["not-signed-in", "behind", "on-track", "ready", "nudge"];
  return valid.includes(param as StatusFilter) ? (param as StatusFilter) : "all";
}

export function matchesFilter(status: StudentStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "nudge") return needsNudge(status);
  return STATUS_PARAM[status] === filter;
}

/** Quem precisa de um empurrão: nunca entrou, ou tem tarefas em atraso. */
export const needsNudge = (status: StudentStatus) => status === "not_signed_in" || status === "behind";

export interface StudentProgress {
  status: StudentStatus;
  /** As tarefas da turma atual, pela ordem da API (prazo mais próximo primeiro). */
  tasks: Assignment[];
  doneCount: number;
  /** Por fazer, incluindo as em atraso. */
  open: Assignment[];
  /** Por fazer e com o prazo antes de hoje. */
  overdue: Assignment[];
}

const isOverdue = (a: Assignment, today: string) => a.dueDate !== null && a.dueDate < today;

export function studentProgress(student: StudentRow, assignments: Assignment[], now: Date = new Date()): StudentProgress {
  const today = localDateKey(now);
  const tasks = student.cohort ? assignments.filter((a) => a.cohort.id === student.cohort?.id) : [];
  const done = new Set(student.completions.map((c) => c.assignmentId));
  const open = tasks.filter((a) => !done.has(a.id));
  const overdue = open.filter((a) => isOverdue(a, today));
  const doneCount = tasks.length - open.length;
  let status: StudentStatus = "on_track";
  if (!student.lastLoginAt) status = "not_signed_in";
  else if (overdue.length > 0) status = "behind";
  else if (tasks.length > 0 && open.length === 0) status = "ready";
  return { status, tasks, doneCount, open, overdue };
}

/** Mais urgente primeiro: pelo estado, depois quem tem mais em atraso, depois o nome. */
export function byUrgency(a: { student: StudentRow; progress: StudentProgress }, b: { student: StudentRow; progress: StudentProgress }): number {
  const status = STATUS_ORDER.indexOf(a.progress.status) - STATUS_ORDER.indexOf(b.progress.status);
  if (status !== 0) return status;
  const overdue = b.progress.overdue.length - a.progress.overdue.length;
  if (overdue !== 0) return overdue;
  return `${a.student.lastName} ${a.student.firstName}`.localeCompare(`${b.student.lastName} ${b.student.firstName}`);
}

// ---------- Turmas ----------

export type CohortTiming =
  | { kind: "upcoming"; days: number }
  | { kind: "today" }
  | { kind: "started"; days: number; week: number };

/** Semana zero: a turma começa nos próximos 14 dias (ou hoje). */
export const WEEK_ZERO_DAYS = 14;

export function cohortTiming(startsOn: string, now: Date = new Date()): CohortTiming {
  const days = daysBetween(localDateKey(now), startsOn);
  if (days > 0) return { kind: "upcoming", days };
  if (days === 0) return { kind: "today" };
  return { kind: "started", days: -days, week: Math.floor(-days / 7) + 1 };
}

export const isWeekZero = (timing: CohortTiming) => timing.kind === "today" || (timing.kind === "upcoming" && timing.days <= WEEK_ZERO_DAYS);

/** "in 4 days", "Tomorrow", "Today", "Week 2". */
export function timingBadge(timing: CohortTiming): string {
  if (timing.kind === "today") return "Today";
  if (timing.kind === "started") return `Week ${timing.week}`;
  return timing.days === 1 ? "Tomorrow" : `in ${timing.days} days`;
}

/** "Starts Mon 9 Nov", "Started Mon 26 Oct". */
export function timingText(startsOn: string, timing: CohortTiming): string {
  if (timing.kind === "today") return "Starts today";
  return `${timing.kind === "started" ? "Started" : "Starts"} ${dayLabel(startsOn)}`;
}

export interface CohortSummary {
  cohort: StaffCohort;
  timing: CohortTiming;
  students: number;
  signedIn: number;
  tourDone: number;
  /** Pares aluno x tarefa com o prazo antes de hoje. */
  dueSoFar: number;
  /** Desses, os feitos até ao dia do prazo (data local da conclusão). */
  onTime: number;
  /** O prazo mais próximo a partir de hoje, para o "First task due ...". */
  nextDue: string | null;
  tasks: number;
  needNudge: number;
}

export function cohortSummary(cohort: StaffCohort, students: StudentRow[], assignments: Assignment[], now: Date = new Date()): CohortSummary {
  const today = localDateKey(now);
  const members = students.filter((s) => s.cohort?.id === cohort.id);
  const tasks = assignments.filter((a) => a.cohort.id === cohort.id);
  const due = tasks.filter((a) => a.dueDate !== null && a.dueDate < today);
  let onTime = 0;
  for (const s of members) {
    const doneAt = new Map(s.completions.map((c) => [c.assignmentId, localDateKey(new Date(c.completedAt))]));
    for (const a of due) {
      const at = doneAt.get(a.id);
      if (at && a.dueDate && at <= a.dueDate) onTime += 1;
    }
  }
  const upcoming = tasks.flatMap((a) => (a.dueDate && a.dueDate >= today ? [a.dueDate] : [])).sort();
  return {
    cohort,
    timing: cohortTiming(cohort.startsOn, now),
    students: members.length,
    signedIn: members.filter((s) => s.lastLoginAt).length,
    tourDone: members.filter((s) => s.tourCompletedAt).length,
    dueSoFar: due.length * members.length,
    onTime,
    nextDue: upcoming[0] ?? null,
    tasks: tasks.length,
    needNudge: members.filter((s) => needsNudge(studentProgress(s, tasks, now).status)).length,
  };
}

/** Percentagem arredondada; sem total é null (o cartão mostra "None due"). */
export const percent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : null);

// ---------- Datas ----------

const weekdayDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const weekdayLong = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

const parseKey = (key: string) => new Date(`${key}T00:00:00`);

/** "Mon 9 Nov" (data local, sem fusos). */
export const dayLabel = (key: string) => weekdayDate.format(parseKey(key));

/** "Thursday 5 November". */
export const todayLabel = (now: Date = new Date()) => longDate.format(now);

/**
 * Onde cai uma data na vida da turma: "D-14" antes do início, "Day 1" no primeiro dia,
 * "Day 8" uma semana depois. É a régua da linha do tempo das tarefas.
 */
export function relativeDay(key: string, startsOn: string): string {
  const diff = daysBetween(startsOn, key);
  return diff < 0 ? `D${diff}` : `Day ${diff + 1}`;
}

// ---------- Lembretes por email (mailto, sem envio pelo servidor) ----------

export interface Sender {
  firstName: string;
  lastName: string;
  staffTitle: string | null;
}

const signature = (sender: Sender) => ["Thanks,", `${sender.firstName} ${sender.lastName}`, ...(sender.staffTitle ? [sender.staffTitle] : [])];

function taskLine(a: Assignment, today: string): string {
  if (!a.dueDate) return `- ${a.title}`;
  return `- ${a.title} (${a.dueDate < today ? "overdue, was due" : "due"} ${dayLabel(a.dueDate)})`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export interface Mail {
  subject: string;
  body: string;
}

/** O lembrete a um aluno: o que lhe falta, com os prazos, assinado por quem está no staff. */
export function studentReminder(
  student: StudentRow,
  progress: StudentProgress,
  cohort: StaffCohort | undefined,
  sender: Sender,
  origin: string,
  now: Date = new Date(),
): Mail {
  const today = localDateKey(now);
  const timing = cohort ? cohortTiming(cohort.startsOn, now) : null;
  // Antes do primeiro dia, o assunto diz quanto falta e até quando ("2 things before Monday").
  const startsOn = cohort && timing?.kind === "upcoming" ? cohort.startsOn : null;
  const missing = progress.open.length;
  const subject = startsOn && missing > 0 ? `${plural(missing, "thing")} before ${weekdayLong.format(parseKey(startsOn))}` : "A quick reminder";

  const lines = [`Hi ${student.firstName},`, ""];
  if (progress.status === "not_signed_in") {
    lines.push("You haven't signed in to Kampus yet. Your account is ready:", `${origin}/login/student`, "");
  }
  if (missing > 0) {
    lines.push(startsOn ? `Before we start on ${dayLabel(startsOn)}, these are still open for you:` : "These cohort tasks are still open for you:");
    lines.push(...progress.open.map((a) => taskLine(a, today)), "");
    if (progress.status !== "not_signed_in") lines.push(`You can tick them off in Kampus: ${origin}/app/tasks`, "");
  } else if (progress.status !== "not_signed_in") {
    lines.push("You're all caught up with your cohort tasks. Just checking in: let me know if you need anything.", "");
  }
  lines.push(...signature(sender));
  return { subject, body: lines.join("\n") };
}

/** O lembrete de uma tarefa a quem ainda não a fez (vai em BCC). */
export function taskReminder(task: Assignment, sender: Sender, origin: string, now: Date = new Date()): Mail {
  const today = localDateKey(now);
  const when = task.dueDate ? ` ${task.dueDate < today ? "It was due" : "It's due"} ${dayLabel(task.dueDate)}.` : "";
  return {
    subject: `Reminder: ${task.title}`,
    body: [
      "Hi,",
      "",
      `A quick reminder to finish "${task.title}".${when}`,
      `You can tick it off in Kampus: ${origin}/app/tasks`,
      "",
      ...signature(sender),
    ].join("\n"),
  };
}

/** Um lembrete a vários alunos (em BCC): entrar na Kampus e ver o que está em atraso. */
export function groupReminder(overdue: Assignment[], sender: Sender, origin: string, now: Date = new Date()): Mail {
  const today = localDateKey(now);
  const lines = ["Hi,", "", `A quick reminder to sign in to Kampus and check your cohort tasks: ${origin}/app/tasks`, ""];
  if (overdue.length > 0) lines.push("These are past their due date:", ...overdue.map((a) => taskLine(a, today)), "");
  lines.push(...signature(sender));
  return { subject: "A quick reminder", body: lines.join("\n") };
}

/**
 * O link mailto. As quebras de linha vão como CRLF (RFC 6068); com `bcc`, ninguém vê os
 * endereços dos outros alunos.
 */
export function mailto(mail: Mail, recipients: { to?: string; bcc?: string[] }): string {
  const enc = (v: string) => encodeURIComponent(v);
  const params = [
    ...(recipients.bcc?.length ? [`bcc=${recipients.bcc.map(enc).join(",")}`] : []),
    `subject=${enc(mail.subject)}`,
    `body=${enc(mail.body.replace(/\n/g, "\r\n"))}`,
  ];
  return `mailto:${recipients.to ? enc(recipients.to) : ""}?${params.join("&")}`;
}
