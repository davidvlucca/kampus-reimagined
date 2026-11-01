import { COHORT_TASK_MESSAGE, type Assignment, type AssignmentDetail, type Cohort, type StudentRow, type Task } from "@kampus/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../src/db/schema.ts";
import { setup, STAFF, STUDENT_A, STUDENT_B } from "./helpers.ts";

// Seed com "hoje" = 2026-11-02. A (Diana) e B (André) estão em Web Dev; A ainda não assinou
// o acordo de aprendizagem, B já.
let t: Awaited<ReturnType<typeof setup>>;
let a: string;
let b: string;
let staff: string;
let web: Cohort;
let ux: Cohort;

const tasksOf = async (cookie: string, query = "") =>
  (await t.request<{ tasks: Task[] }>("GET", `/api/tasks${query}`, { cookie })).json.tasks;
const assignmentsOf = async (cohort: Cohort) =>
  (await t.request<{ assignments: Assignment[] }>("GET", `/api/staff/assignments?cohortId=${cohort.id}`, { cookie: staff })).json.assignments;
const byTitle = <T extends { title: string }>(list: T[], title: string) => list.find((x) => x.title === title)!;
const studentRow = async (email: string) =>
  (await t.request<{ students: StudentRow[] }>("GET", `/api/staff/students?q=${encodeURIComponent(email)}`, { cookie: staff })).json.students[0]!;

beforeAll(async () => {
  t = await setup();
  a = await t.login(STUDENT_A, "student");
  b = await t.login(STUDENT_B, "student");
  staff = await t.login(STAFF, "staff");
  const cohorts = (await t.request<{ cohorts: Cohort[] }>("GET", "/api/cohorts", { cookie: staff })).json.cohorts;
  web = cohorts.find((c) => c.name === "Web Dev Oct 2026")!;
  ux = cohorts.find((c) => c.name === "UX/UI Oct 2026")!;
});
afterAll(() => t.close());

describe("seed: tarefas da turma", () => {
  it("cada turma tem as suas 3, com autor, contagens e a ordem por prazo", async () => {
    const list = await assignmentsOf(web);
    expect(list.map((x) => x.title)).toEqual(["Sign the learning agreement", "Install Node.js and VS Code", "Book a chat with the Career Coach"]);
    expect(list.map((x) => x.createdBy?.title)).toEqual(["Program Manager", "Lead Teacher", "Career Coach"]);
    // 8 alunos em Web Dev; o acordo está feito por todos menos i % 3 === 0 (i = 0, 3, 6).
    expect(list.map((x) => [x.students, x.done])).toEqual([[8, 5], [8, 0], [8, 0]]);
    expect(list.every((x) => x.cohort.id === web.id)).toBe(true);

    const all = (await t.request<{ assignments: Assignment[] }>("GET", "/api/staff/assignments", { cookie: staff })).json.assignments;
    expect(all).toHaveLength(9);
  });

  it("as contagens de tarefas dos alunos somam as pessoais e as da turma", async () => {
    // 4 pessoais + 3 da turma. Diana: só o guia feito. André: guia, visita e acordo.
    expect(await studentRow(STUDENT_A)).toMatchObject({ taskCount: 7, doneTaskCount: 1 });
    expect(await studentRow(STUDENT_B)).toMatchObject({ taskCount: 7, doneTaskCount: 3 });
  });
});

describe("o aluno vê as tarefas da sua turma", () => {
  it("vêm na lista com source 'cohort', autor e na ordem certa", async () => {
    const list = await tasksOf(a);
    expect(list.map((x) => x.title)).toEqual([
      "Sign the learning agreement",
      "Install Node.js and VS Code",
      "Join the cohort chat and say hi",
      "Take the virtual campus tour",
      "Book a chat with the Career Coach",
      "Pick an idea for your first project",
      "Read the welcome guide",
    ]);
    const agreement = byTitle(list, "Sign the learning agreement");
    expect(agreement).toMatchObject({ source: "cohort", done: false, completedAt: null, dueDate: "2026-11-01" });
    expect(agreement.assignedBy).toEqual({ id: await t.userId(STAFF), firstName: "Marta", lastName: "Lopes", title: "Program Manager" });
    const personal = byTitle(list, "Read the welcome guide");
    expect(personal).toMatchObject({ source: "personal", assignedBy: null });
  });

  it("não vê as tarefas de outra turma", async () => {
    const uxIds = (await assignmentsOf(ux)).map((x) => x.id);
    const mine = (await tasksOf(a)).map((x) => x.id);
    expect(uxIds).toHaveLength(3);
    for (const id of uxIds) expect(mine).not.toContain(id);
    expect((await tasksOf(a)).map((x) => x.title)).not.toContain("Install Figma and join the team file");
  });

  it("o filtro por estado também se aplica às tarefas da turma", async () => {
    const doneB = await tasksOf(b, "?status=done");
    expect(doneB.map((x) => x.title)).toContain("Sign the learning agreement");
    expect(doneB.every((x) => x.done)).toBe(true);
    const openB = await tasksOf(b, "?status=open");
    expect(openB.map((x) => x.title)).not.toContain("Sign the learning agreement");
    expect(openB.map((x) => x.title)).toContain("Install Node.js and VS Code");
    expect(openB.every((x) => !x.done)).toBe(true);
  });
});

describe("o aluno só marca a tarefa da turma como feita (ou não)", () => {
  it("marcar e desmarcar é por aluno: o colega da mesma turma não muda", async () => {
    const setupTask = byTitle(await tasksOf(a), "Install Node.js and VS Code");

    const done = await t.request<{ task: Task }>("PATCH", `/api/tasks/${setupTask.id}`, { cookie: a, body: { done: true } });
    expect(done.status).toBe(200);
    expect(done.json.task).toMatchObject({ id: setupTask.id, source: "cohort", done: true });
    expect(done.json.task.completedAt).not.toBeNull();
    expect(done.json.task.assignedBy?.title).toBe("Lead Teacher");

    // Marcar outra vez não muda a data da conclusão.
    const again = await t.request<{ task: Task }>("PATCH", `/api/tasks/${setupTask.id}`, { cookie: a, body: { done: true } });
    expect(again.json.task.completedAt).toBe(done.json.task.completedAt);

    expect(byTitle(await tasksOf(b), "Install Node.js and VS Code").done).toBe(false);
    expect(byTitle(await assignmentsOf(web), "Install Node.js and VS Code").done).toBe(1);

    const undone = await t.request<{ task: Task }>("PATCH", `/api/tasks/${setupTask.id}`, { cookie: a, body: { done: false } });
    expect(undone.json.task).toMatchObject({ done: false, completedAt: null });
    expect(byTitle(await tasksOf(a), "Install Node.js and VS Code").done).toBe(false);
    expect(byTitle(await assignmentsOf(web), "Install Node.js and VS Code").done).toBe(0);
  });

  it("mudar o título ou o prazo, ou apagar, dá 403 com a mensagem", async () => {
    const task = byTitle(await tasksOf(a), "Book a chat with the Career Coach");
    for (const body of [{ title: "Renamed" }, { dueDate: null }, { dueDate: "2026-12-01" }, { done: true, title: "Renamed" }]) {
      const res = await t.request<{ error: string }>("PATCH", `/api/tasks/${task.id}`, { cookie: a, body });
      expect(res.status).toBe(403);
      expect(res.json.error).toBe(COHORT_TASK_MESSAGE);
    }
    const del = await t.request<{ error: string }>("DELETE", `/api/tasks/${task.id}`, { cookie: a });
    expect(del.status).toBe(403);
    expect(del.json.error).toBe(COHORT_TASK_MESSAGE);

    const after = byTitle(await tasksOf(a), "Book a chat with the Career Coach");
    expect(after).toMatchObject({ id: task.id, done: false, dueDate: task.dueDate });
  });

  it("a tarefa de outra turma responde 404, como se não existisse", async () => {
    const other = (await assignmentsOf(ux))[0]!;
    for (const body of [{ done: true }, { title: "Hacked" }]) {
      const res = await t.request<{ error: string }>("PATCH", `/api/tasks/${other.id}`, { cookie: a, body });
      expect(res.status).toBe(404);
      expect(res.json.error).toBe("Task not found.");
    }
    expect((await t.request("DELETE", `/api/tasks/${other.id}`, { cookie: a })).status).toBe(404);
    expect(byTitle(await assignmentsOf(ux), other.title).done).toBe(other.done);
  });

  it("criar uma tarefa continua a criar uma pessoal", async () => {
    const res = await t.request<{ task: Task }>("POST", "/api/tasks", { cookie: a, body: { title: "My own" } });
    expect(res.status).toBe(201);
    expect(res.json.task).toMatchObject({ source: "personal", assignedBy: null });
  });
});

describe("gestão das tarefas da turma pelo staff", () => {
  it("cria, vê o progresso, edita e apaga", async () => {
    const created = await t.request<{ assignment: Assignment }>("POST", "/api/staff/assignments", {
      cookie: staff,
      body: { cohortId: web.id, title: "  Bring your laptop charger  ", dueDate: "2026-11-04" },
    });
    expect(created.status).toBe(201);
    const assignment = created.json.assignment;
    expect(assignment).toMatchObject({
      title: "Bring your laptop charger",
      dueDate: "2026-11-04",
      cohort: web,
      createdBy: { firstName: "Marta", lastName: "Lopes", title: "Program Manager" },
      students: 8,
      done: 0,
    });

    // O aluno já a vê e marca-a como feita.
    expect(byTitle(await tasksOf(a), "Bring your laptop charger").source).toBe("cohort");
    await t.request("PATCH", `/api/tasks/${assignment.id}`, { cookie: a, body: { done: true } });

    const detail = await t.request<{ assignment: AssignmentDetail }>("GET", `/api/staff/assignments/${assignment.id}`, { cookie: staff });
    expect(detail.status).toBe(200);
    expect(detail.json.assignment.done).toBe(1);
    // Primeiro quem não a fez (por nome), no fim a Diana, que já a fez.
    expect(detail.json.assignment.progress.map((p) => [p.student.firstName, p.done])).toEqual([
      ["André", false],
      ["Beatriz", false],
      ["Carlos", false],
      ["Elena", false],
      ["Filipe", false],
      ["Hana", false],
      ["Lucas", false],
      ["Diana", true],
    ]);
    expect(detail.json.assignment.progress.at(-1)!.completedAt).not.toBeNull();
    expect(detail.json.assignment.progress[0]!.completedAt).toBeNull();

    const edited = await t.request<{ assignment: Assignment }>("PATCH", `/api/staff/assignments/${assignment.id}`, {
      cookie: staff,
      body: { title: "Bring your charger", dueDate: null },
    });
    expect(edited.status).toBe(200);
    expect(edited.json.assignment).toMatchObject({ title: "Bring your charger", dueDate: null, done: 1 });
    expect(edited.json.assignment.updatedAt > assignment.updatedAt).toBe(true);
    // A mudança chega ao aluno, que continua com ela feita.
    expect(byTitle(await tasksOf(a), "Bring your charger")).toMatchObject({ dueDate: null, done: true });

    expect((await t.request("DELETE", `/api/staff/assignments/${assignment.id}`, { cookie: staff })).status).toBe(204);
    expect((await t.request("GET", `/api/staff/assignments/${assignment.id}`, { cookie: staff })).status).toBe(404);
    expect((await tasksOf(a)).map((x) => x.id)).not.toContain(assignment.id);
    expect((await t.request("DELETE", `/api/staff/assignments/${assignment.id}`, { cookie: staff })).status).toBe(404);
  });

  it("uma turma que não existe dá 400 no campo cohortId", async () => {
    for (const cohortId of ["00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      const res = await t.request<{ error: string; fields: Record<string, string> }>("POST", "/api/staff/assignments", {
        cookie: staff,
        body: { cohortId, title: "Nope" },
      });
      expect(res.status).toBe(400);
      expect(res.json.fields.cohortId).toBe("Choose a cohort");
    }
  });

  it("um título vazio ou um corpo vazio dão 400", async () => {
    expect((await t.request("POST", "/api/staff/assignments", { cookie: staff, body: { cohortId: web.id, title: " " } })).status).toBe(400);
    const id = (await assignmentsOf(web))[0]!.id;
    expect((await t.request("PATCH", `/api/staff/assignments/${id}`, { cookie: staff, body: {} })).status).toBe(400);
  });

  it("um id desconhecido ou que não é UUID dá 404", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    for (const id of [unknown, "123"]) {
      for (const [method, body] of [["GET"], ["PATCH", { title: "X" }], ["DELETE"]] as const) {
        const res = await t.request<{ error: string }>(method, `/api/staff/assignments/${id}`, { cookie: staff, body });
        expect(res.status).toBe(404);
        expect(res.json.error).toBe("Task not found.");
      }
    }
  });

  it("aluno recebe 403 e sem sessão 401", async () => {
    expect((await t.request("GET", "/api/staff/assignments", { cookie: a })).status).toBe(403);
    expect((await t.request("POST", "/api/staff/assignments", { cookie: a, body: { cohortId: web.id, title: "X" } })).status).toBe(403);
    expect((await t.request("GET", "/api/staff/assignments")).status).toBe(401);
  });
});

describe("mudar de turma", () => {
  it("o aluno deixa de ver as tarefas da turma antiga e as contagens seguem a turma atual", async () => {
    const email = "beatriz.nunes@example.com"; // Web Dev, já assinou o acordo.
    const cookie = await t.login(email, "student");
    const oldAgreement = byTitle(await tasksOf(cookie), "Sign the learning agreement");
    expect(oldAgreement.done).toBe(true);
    expect(await studentRow(email)).toMatchObject({ taskCount: 7, doneTaskCount: 3 });

    const id = await t.userId(email);
    expect((await t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { cohortId: ux.id } })).status).toBe(200);

    const list = await tasksOf(cookie);
    expect(list.map((x) => x.id)).not.toContain(oldAgreement.id);
    expect(list.map((x) => x.title)).toContain("Install Figma and join the team file");
    // O acordo de UX/UI ainda não está feito por ela.
    expect(byTitle(list, "Sign the learning agreement").done).toBe(false);
    expect((await t.request("PATCH", `/api/tasks/${oldAgreement.id}`, { cookie, body: { done: false } })).status).toBe(404);

    // Web Dev perde uma aluna (e a conclusão dela); UX/UI ganha uma, sem conclusão.
    expect(byTitle(await assignmentsOf(web), "Sign the learning agreement")).toMatchObject({ students: 7, done: 4 });
    expect(byTitle(await assignmentsOf(ux), "Sign the learning agreement")).toMatchObject({ students: 7, done: 4 });
    expect(await studentRow(email)).toMatchObject({ taskCount: 7, doneTaskCount: 2 });
  });
});

describe("autor apagado", () => {
  it("a tarefa fica, com assignedBy e createdBy a null", async () => {
    const email = "tiago.ramos@example.com";
    const cookie = await t.login(email, "staff");
    const created = await t.request<{ assignment: Assignment }>("POST", "/api/staff/assignments", {
      cookie,
      body: { cohortId: web.id, title: "Collect your locker key" },
    });
    expect(created.json.assignment.createdBy?.title).toBe("Campus Manager");

    // A API não deixa apagar staff: apaga-se diretamente na base.
    await t.db.delete(users).where(eq(users.id, await t.userId(email)));

    expect(byTitle(await tasksOf(a), "Collect your locker key")).toMatchObject({ source: "cohort", assignedBy: null });
    const detail = await t.request<{ assignment: AssignmentDetail }>("GET", `/api/staff/assignments/${created.json.assignment.id}`, { cookie: staff });
    expect(detail.json.assignment.createdBy).toBeNull();
  });
});

describe("o hash da password nunca sai nas rotas de tarefas da turma", () => {
  it("nenhuma resposta deste ficheiro contém o hash", () => {
    expect(t.seenBodies.length).toBeGreaterThan(30);
    for (const body of t.seenBodies) {
      expect(body).not.toMatch(/\$argon2/);
      expect(body).not.toMatch(/password_?hash/i);
    }
  });
});
