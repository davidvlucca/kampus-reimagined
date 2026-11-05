import type { Assignment, StaffCohort, StudentRow } from "@kampus/shared";
import { describe, expect, it } from "vitest";
import {
  byUrgency,
  cohortSummary,
  cohortTiming,
  isWeekZero,
  mailto,
  matchesFilter,
  relativeDay,
  statusFilter,
  studentProgress,
  studentReminder,
  taskReminder,
  timingBadge,
} from "./progress.ts";

// "Hoje" é quinta, 5 de novembro de 2026, ao meio-dia (hora local).
const NOW = new Date(2026, 10, 5, 12, 0);
const WEB: StaffCohort = { id: "c-web", name: "Web Dev Oct 2026", startsOn: "2026-11-09" };
const UX: StaffCohort = { id: "c-ux", name: "UX/UI Oct 2026", startsOn: "2026-10-26" };

const task = (id: string, dueDate: string | null, cohort: StaffCohort = WEB, title = `Task ${id}`): Assignment => ({
  id,
  title,
  dueDate,
  cohort: { id: cohort.id, name: cohort.name },
  createdBy: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  students: 0,
  done: 0,
});

const student = (over: Partial<StudentRow> & { done?: [string, Date][] } = {}): StudentRow => ({
  id: over.id ?? "s1",
  firstName: over.firstName ?? "Tiago",
  lastName: over.lastName ?? "Ferreira",
  email: over.email ?? "tiago@example.com",
  cohort: over.cohort === undefined ? { id: WEB.id, name: WEB.name } : over.cohort,
  tourCompletedAt: over.tourCompletedAt ?? null,
  lastLoginAt: over.lastLoginAt === undefined ? "2026-11-05T09:00:00.000Z" : over.lastLoginAt,
  createdAt: "2026-10-20T09:00:00.000Z",
  taskCount: 0,
  doneTaskCount: 0,
  noteCount: 0,
  completions: (over.done ?? []).map(([assignmentId, at]) => ({ assignmentId, completedAt: at.toISOString() })),
});

const TASKS = [task("a", "2026-11-03"), task("b", "2026-11-06"), task("c", null), task("x", "2026-11-01", UX)];

describe("estado do aluno", () => {
  it("nunca entrou vem antes de tudo, mesmo com tarefas em atraso", () => {
    expect(studentProgress(student({ lastLoginAt: null }), TASKS, NOW).status).toBe("not_signed_in");
  });

  it("uma tarefa em atraso por fazer põe-no em Behind; ontem conta, hoje não", () => {
    const p = studentProgress(student(), TASKS, NOW);
    expect(p.status).toBe("behind");
    expect(p.overdue.map((a) => a.id)).toEqual(["a"]);
    // Só as da turma dele.
    expect(p.tasks.map((a) => a.id)).toEqual(["a", "b", "c"]);
    const dueToday = studentProgress(student(), [task("t", "2026-11-05")], NOW);
    expect(dueToday.status).toBe("on_track");
  });

  it("Ready é ter feito todas; sem tarefas na turma fica On track", () => {
    const all = student({ done: TASKS.slice(0, 3).map((a) => [a.id, NOW] as [string, Date]) });
    expect(studentProgress(all, TASKS, NOW)).toMatchObject({ status: "ready", doneCount: 3 });
    expect(studentProgress(student(), [], NOW).status).toBe("on_track");
    expect(studentProgress(student({ cohort: null }), TASKS, NOW).tasks).toEqual([]);
  });

  it("o filtro do URL aceita só os valores conhecidos e o nudge junta dois estados", () => {
    expect(statusFilter("behind")).toBe("behind");
    expect(statusFilter("<script>")).toBe("all");
    expect(statusFilter(null)).toBe("all");
    expect(matchesFilter("not_signed_in", "nudge")).toBe(true);
    expect(matchesFilter("behind", "nudge")).toBe(true);
    expect(matchesFilter("on_track", "nudge")).toBe(false);
    expect(matchesFilter("ready", "ready")).toBe(true);
  });

  it("os mais urgentes primeiro: estado, depois quem tem mais em atraso", () => {
    const rows = [
      student({ id: "ok", lastName: "A", done: [["a", NOW]] }),
      student({ id: "never", lastName: "Z", lastLoginAt: null }),
      student({ id: "late", lastName: "M" }),
    ].map((s) => ({ student: s, progress: studentProgress(s, TASKS, NOW) }));
    expect(rows.sort(byUrgency).map((r) => r.student.id)).toEqual(["never", "late", "ok"]);
  });
});

describe("turma", () => {
  it("antes do início conta os dias; depois, a semana", () => {
    expect(cohortTiming(WEB.startsOn, NOW)).toEqual({ kind: "upcoming", days: 4 });
    expect(timingBadge(cohortTiming(WEB.startsOn, NOW))).toBe("in 4 days");
    expect(cohortTiming(UX.startsOn, NOW)).toEqual({ kind: "started", days: 10, week: 2 });
    expect(cohortTiming("2026-11-05", NOW)).toEqual({ kind: "today" });
    expect(isWeekZero(cohortTiming(WEB.startsOn, NOW))).toBe(true);
    expect(isWeekZero(cohortTiming("2026-11-23", NOW))).toBe(false);
    expect(isWeekZero(cohortTiming(UX.startsOn, NOW))).toBe(false);
  });

  it("on time conta as conclusões até ao dia do prazo, só das tarefas já vencidas", () => {
    const students = [
      // Fez "a" no dia do prazo (à noite, hora local): a tempo.
      student({ id: "1", done: [["a", new Date(2026, 10, 3, 23, 30)]] }),
      // Fez "a" depois do prazo: não conta como a tempo.
      student({ id: "2", done: [["a", new Date(2026, 10, 4, 8, 0)]] }),
      student({ id: "3", lastLoginAt: null }),
      student({ id: "4", cohort: { id: UX.id, name: UX.name } }),
    ];
    const s = cohortSummary(WEB, students, TASKS, NOW);
    expect(s).toMatchObject({ students: 3, signedIn: 2, dueSoFar: 3, onTime: 1, nextDue: "2026-11-06", tasks: 3 });
    // 2 está em atraso? Não: fez "a" (tarde, mas feita). 3 nunca entrou. 1 está a tempo.
    expect(s.needNudge).toBe(1);
  });

  it("a régua da linha do tempo: D-14, Day 1, Day 8", () => {
    expect(relativeDay("2026-10-26", WEB.startsOn)).toBe("D-14");
    expect(relativeDay("2026-11-09", WEB.startsOn)).toBe("Day 1");
    expect(relativeDay("2026-11-16", WEB.startsOn)).toBe("Day 8");
  });
});

describe("lembretes por email", () => {
  const sender = { firstName: "Marta", lastName: "Lopes", staffTitle: "Program Manager" };

  it("antes do início, o assunto diz quanto falta e o corpo lista o que falta com os prazos", () => {
    const s = student();
    const mail = studentReminder(s, studentProgress(s, TASKS, NOW), WEB, sender, "https://kampus.test", NOW);
    expect(mail.subject).toBe("3 things before Monday");
    expect(mail.body).toContain("Hi Tiago,");
    expect(mail.body).toContain("- Task a (overdue, was due Tue 3 Nov)");
    expect(mail.body).toContain("- Task b (due Fri 6 Nov)");
    expect(mail.body).toContain("- Task c\n");
    expect(mail.body).toContain("https://kampus.test/app/tasks");
    expect(mail.body.endsWith("Thanks,\nMarta Lopes\nProgram Manager")).toBe(true);
  });

  it("quem nunca entrou recebe o link do login; uma turma já começada dá 'A quick reminder'", () => {
    const s = student({ lastLoginAt: null, cohort: { id: UX.id, name: UX.name } });
    const mail = studentReminder(s, studentProgress(s, TASKS, NOW), UX, sender, "https://kampus.test", NOW);
    expect(mail.subject).toBe("A quick reminder");
    expect(mail.body).toContain("https://kampus.test/login/student");
  });

  it("o mailto codifica tudo, com CRLF, e o BCC esconde os endereços", () => {
    const link = mailto(taskReminder(TASKS[0]!, sender, "https://kampus.test", NOW), { bcc: ["a@example.com", "b+x@example.com"] });
    expect(link.startsWith("mailto:?bcc=a%40example.com,b%2Bx%40example.com&subject=Reminder%3A%20Task%20a&body=")).toBe(true);
    expect(link).toContain("%0D%0A");
    expect(link).not.toContain(" ");
    expect(mailto({ subject: "Hi & bye", body: "x" }, { to: "t@example.com" })).toBe("mailto:t%40example.com?subject=Hi%20%26%20bye&body=x");
  });
});
