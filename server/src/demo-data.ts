// Dados de demonstração. TODOS os nomes, emails e textos são fictícios.
// Usado pelo seed (npm run db:seed / db:reset), pelos testes e pela reposição diária da demo.
import { addDays, localDateKey } from "@kampus/shared";
import { sql } from "drizzle-orm";
import { hashPassword } from "./auth/password.ts";
import type { Db } from "./db/client.ts";
import { assignmentCompletions, assignments, cohorts, notes, tasks, users } from "./db/schema.ts";

export const DEMO_PASSWORD = "Kampus123";

const STAFF = [
  {
    firstName: "Marta",
    lastName: "Lopes",
    email: "staff@example.com",
    staffTitle: "Program Manager",
    staffHelpsWith: "Your first stop for the schedule, attendance, absences and anything about how the program works.",
  },
  {
    firstName: "Rui",
    lastName: "Matos",
    email: "rui.matos@example.com",
    staffTitle: "Lead Teacher",
    staffHelpsWith: "Questions about the curriculum, project briefs, code reviews and what to study next.",
  },
  {
    firstName: "Inês",
    lastName: "Duarte",
    email: "ines.duarte@example.com",
    staffTitle: "Teaching Assistant",
    staffHelpsWith: "Day-to-day help with labs, exercises and bugs you've been stuck on for more than 20 minutes.",
  },
  {
    firstName: "Joana",
    lastName: "Reis",
    email: "joana.reis@example.com",
    staffTitle: "Career Coach",
    staffHelpsWith: "Your CV, portfolio and LinkedIn, interview practice and the job search after the course.",
  },
  {
    firstName: "Tiago",
    lastName: "Ramos",
    email: "tiago.ramos@example.com",
    staffTitle: "Campus Manager",
    staffHelpsWith: "Building access, Wi-Fi, lockers, lost and found, and the kitchen and lounge rules.",
  },
];

const COHORTS = [
  { key: "web", name: "Web Dev Oct 2026", setup: "Install Node.js and VS Code" },
  { key: "ux", name: "UX/UI Oct 2026", setup: "Install Figma and join the team file" },
  { key: "data", name: "Data Analytics Oct 2026", setup: "Install Python and Jupyter" },
] as const;
type CohortKey = (typeof COHORTS)[number]["key"];

// [nome, apelido, turma, fez a visita?]. O primeiro é a conta student@example.com.
const STUDENTS: [string, string, CohortKey, boolean][] = [
  ["Diana", "Costa", "web", false],
  ["André", "Pinto", "web", true],
  ["Beatriz", "Nunes", "web", true],
  ["Carlos", "Mendes", "web", false],
  ["Elena", "Varga", "web", true],
  ["Filipe", "Gomes", "web", true],
  ["Hana", "Sato", "web", false],
  ["Lucas", "Oliveira", "web", true],
  ["Mariana", "Teixeira", "ux", true],
  ["Nuno", "Barros", "ux", true],
  ["Olivia", "Brown", "ux", false],
  ["Pedro", "Faria", "ux", true],
  ["Rita", "Moreira", "ux", true],
  ["Samuel", "Okafor", "ux", false],
  ["Sara", "Correia", "data", true],
  ["Tomás", "Lima", "data", true],
  ["Vera", "Antunes", "data", false],
  ["Yara", "Haddad", "data", true],
  ["Zé", "Carvalho", "data", true],
  ["Laura", "Fischer", "data", false],
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export interface SeedOptions {
  /** "Hoje" do seed, YYYY-MM-DD. */
  today?: string;
}

export async function seedDatabase(db: Db, options: SeedOptions = {}) {
  const today = options.today ?? localDateKey(new Date());
  // Meio-dia de "hoje" em UTC como base dos carimbos de data/hora.
  const noon = new Date(`${today}T12:00:00Z`).getTime();
  const hoursAgo = (h: number) => new Date(noon - h * 60 * 60 * 1000);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const cohortRows = await db
    .insert(cohorts)
    .values(COHORTS.map((c) => ({ name: c.name, startsOn: addDays(today, -7) })))
    .returning();
  const cohortId = (key: CohortKey) => cohortRows.find((r) => r.name === COHORTS.find((c) => c.key === key)!.name)!.id;

  const staffRows = await db
    .insert(users)
    .values(
      STAFF.map((s, i) => ({
        ...s,
        passwordHash,
        role: "staff" as const,
        lastLoginAt: hoursAgo(2 + i),
        createdAt: hoursAgo(24 * 30 - i),
      })),
    )
    .returning({ id: users.id, staffTitle: users.staffTitle });
  const staffId = (title: string) => staffRows.find((r) => r.staffTitle === title)!.id;

  // Tarefas da turma: as mesmas três em cada turma, cada uma criada por quem trata do assunto.
  const assignmentRows = await db
    .insert(assignments)
    .values(
      COHORTS.flatMap((c) => [
        { cohortId: cohortId(c.key), createdBy: staffId("Program Manager"), title: "Sign the learning agreement", dueDate: addDays(today, -1) },
        { cohortId: cohortId(c.key), createdBy: staffId("Lead Teacher"), title: c.setup, dueDate: today },
        { cohortId: cohortId(c.key), createdBy: staffId("Career Coach"), title: "Book a chat with the Career Coach", dueDate: addDays(today, 12) },
      ]).map((a) => ({ ...a, createdAt: hoursAgo(24 * 7), updatedAt: hoursAgo(24 * 7) })),
    )
    .returning({ id: assignments.id, cohortId: assignments.cohortId, title: assignments.title });
  const assignmentId = (cohort: string, title: string) =>
    assignmentRows.find((a) => a.cohortId === cohort && a.title === title)!.id;

  const studentRows = await db
    .insert(users)
    .values(
      STUDENTS.map(([firstName, lastName, cohort, tourDone], i) => ({
        firstName,
        lastName,
        email: i === 0 ? "student@example.com" : `${slug(firstName)}.${slug(lastName)}@example.com`,
        passwordHash,
        role: "student" as const,
        cohortId: cohortId(cohort),
        tourCompletedAt: tourDone ? hoursAgo(20 + i * 7) : null,
        // A conta de demo nunca entrou: a visita abre sozinha no primeiro login.
        lastLoginAt: i === 0 ? null : hoursAgo(1 + i * 3),
        createdAt: hoursAgo(24 * 8 + i),
      })),
    )
    .returning({ id: users.id, cohortId: users.cohortId, tourCompletedAt: users.tourCompletedAt });

  const taskValues: (typeof tasks.$inferInsert)[] = [];
  const noteValues: (typeof notes.$inferInsert)[] = [];
  const completionValues: (typeof assignmentCompletions.$inferInsert)[] = [];

  studentRows.forEach((student, i) => {
    const done = (title: string, dueDate: string | null, doneHoursAgo: number) => ({
      userId: student.id,
      title,
      dueDate,
      done: true,
      completedAt: hoursAgo(doneHoursAgo),
      createdAt: hoursAgo(24 * 7),
    });
    const open = (title: string, dueDate: string | null) => ({
      userId: student.id,
      title,
      dueDate,
      createdAt: hoursAgo(24 * 7),
    });

    taskValues.push(
      done("Read the welcome guide", addDays(today, -3), 24 * 4),
      open("Join the cohort chat and say hi", addDays(today, 1)),
      student.tourCompletedAt
        ? done("Take the virtual campus tour", addDays(today, 2), 20 + i * 7)
        : open("Take the virtual campus tour", addDays(today, 2)),
      open("Pick an idea for your first project", null),
    );

    // Das tarefas da turma, só o acordo de aprendizagem já está feito (por dois em cada três).
    if (i % 3 !== 0) {
      completionValues.push({
        assignmentId: assignmentId(student.cohortId!, "Sign the learning agreement"),
        userId: student.id,
        completedAt: hoursAgo(30),
      });
    }

    noteValues.push(
      {
        userId: student.id,
        title: "Day 1: welcome session",
        body: "Doors open at 8:30. Classes 9:00 to 18:00, lunch at 13:00.\nAsk the Campus Manager for a locker key.\nWi-Fi details are on the board in the kitchen.",
        createdAt: hoursAgo(24 * 6),
        updatedAt: hoursAgo(24 * 6),
      },
      {
        userId: student.id,
        title: "Questions for the TA",
        body: "- Best way to ask for help during labs?\n- Where do we hand in the daily exercises?",
        createdAt: hoursAgo(24 * 3),
        updatedAt: hoursAgo(24 * 2),
      },
      {
        userId: student.id,
        title: "Ideas for the first project",
        body: "Something useful for new students... maybe an app to find your way around campus?",
        createdAt: hoursAgo(26),
        updatedAt: hoursAgo(5),
      },
    );
  });

  await db.insert(tasks).values(taskValues);
  await db.insert(assignmentCompletions).values(completionValues);
  await db.insert(notes).values(noteValues);

  return { staff: STAFF.length, students: studentRows.length, cohorts: cohortRows.length };
}

export async function resetDatabase(db: Db) {
  await db.execute(sql`truncate table login_attempts, sessions, assignment_completions, assignments, notes, tasks, users, cohorts restart identity cascade`);
}
