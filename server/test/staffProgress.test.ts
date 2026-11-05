import type { Assignment, Cohort, StaffCohort, StaffOverview, StudentRow } from "@kampus/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup, STAFF, STUDENT_A, STUDENT_B } from "./helpers.ts";

// Os dados que o redesenho do staff usa para os estados ("Behind", "Ready"), o "on time" e a
// linha do tempo. Seed com "hoje" = 2026-11-02: as turmas começaram a 2026-10-26.
let t: Awaited<ReturnType<typeof setup>>;
let staff: string;
let student: string;
let web: Cohort;
let ux: Cohort;

const students = async (query = "") =>
  (await t.request<{ students: StudentRow[] }>("GET", `/api/staff/students${query}`, { cookie: staff })).json.students;
const rowOf = async (email: string) => (await students(`?q=${encodeURIComponent(email)}`))[0]!;
const assignmentsOf = async (cohort: Cohort) =>
  (await t.request<{ assignments: Assignment[] }>("GET", `/api/staff/assignments?cohortId=${cohort.id}`, { cookie: staff })).json.assignments;
const overview = async () => (await t.request<StaffOverview>("GET", "/api/staff/overview", { cookie: staff })).json;

beforeAll(async () => {
  t = await setup();
  staff = await t.login(STAFF, "staff");
  student = await t.login(STUDENT_A, "student");
  const cohorts = (await t.request<{ cohorts: Cohort[] }>("GET", "/api/cohorts", { cookie: staff })).json.cohorts;
  web = cohorts.find((c) => c.name === "Web Dev Oct 2026")!;
  ux = cohorts.find((c) => c.name === "UX/UI Oct 2026")!;
});
afterAll(() => t.close());

describe("GET /api/staff/cohorts", () => {
  it("dá as turmas com a data de início, pela data e depois pelo nome", async () => {
    const res = await t.request<{ cohorts: StaffCohort[] }>("GET", "/api/staff/cohorts", { cookie: staff });
    expect(res.status).toBe(200);
    expect(res.json.cohorts.map((c) => c.name)).toEqual(["Data Analytics Oct 2026", "UX/UI Oct 2026", "Web Dev Oct 2026"]);
    expect(res.json.cohorts.every((c) => c.startsOn === "2026-10-26")).toBe(true);
    // Só os três campos: nada da tabela sai sem passar pelo mapeamento.
    expect(Object.keys(res.json.cohorts[0]!).sort()).toEqual(["id", "name", "startsOn"]);
  });

  it("aluno recebe 403 e sem sessão 401", async () => {
    expect((await t.request("GET", "/api/staff/cohorts", { cookie: student })).status).toBe(403);
    expect((await t.request("GET", "/api/staff/cohorts")).status).toBe(401);
  });
});

describe("conclusões das tarefas da turma na lista de alunos", () => {
  it("cada aluno traz as conclusões da turma atual, com a hora", async () => {
    const agreement = (await assignmentsOf(web)).find((a) => a.title === "Sign the learning agreement")!;
    // Diana (i = 0) ainda não assinou; André (i = 1) já.
    expect((await rowOf(STUDENT_A)).completions).toEqual([]);
    const andre = await rowOf(STUDENT_B);
    expect(andre.completions).toEqual([{ assignmentId: agreement.id, completedAt: expect.any(String) }]);
    expect(Number.isNaN(Date.parse(andre.completions[0]!.completedAt))).toBe(false);

    // Os totais batem com as conclusões de cada aluno.
    const all = await students(`?cohortId=${web.id}`);
    expect(all.reduce((sum, s) => sum + s.completions.length, 0)).toBe(agreement.done);
  });

  it("marcar uma tarefa aparece logo na lista do staff", async () => {
    const tasks = (await t.request<{ tasks: { id: string; title: string }[] }>("GET", "/api/tasks", { cookie: student })).json.tasks;
    const setup = tasks.find((x) => x.title === "Install Node.js and VS Code")!;
    expect((await t.request("PATCH", `/api/tasks/${setup.id}`, { cookie: student, body: { done: true } })).status).toBe(200);
    expect((await rowOf(STUDENT_A)).completions.map((c) => c.assignmentId)).toEqual([setup.id]);
    expect((await t.request("PATCH", `/api/tasks/${setup.id}`, { cookie: student, body: { done: false } })).status).toBe(200);
    expect((await rowOf(STUDENT_A)).completions).toEqual([]);
  });

  it("ao mudar de turma, as conclusões da antiga deixam de vir (e voltam se regressar)", async () => {
    const id = await t.userId(STUDENT_B);
    const move = (cohortId: string) => t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { cohortId } });
    expect((await move(ux.id)).status).toBe(200);
    expect((await rowOf(STUDENT_B)).completions).toEqual([]);
    expect((await move(web.id)).status).toBe(200);
    expect((await rowOf(STUDENT_B)).completions).toHaveLength(1);
  });
});

describe("atividade recente com tarefas feitas e a turma", () => {
  it("inclui as tarefas da turma marcadas, com o título e a turma do aluno", async () => {
    const tasks = (await t.request<{ tasks: { id: string; title: string }[] }>("GET", "/api/tasks", { cookie: student })).json.tasks;
    const setup = tasks.find((x) => x.title === "Install Node.js and VS Code")!;
    expect((await t.request("PATCH", `/api/tasks/${setup.id}`, { cookie: student, body: { done: true } })).status).toBe(200);

    const { recentActivity } = await overview();
    const done = recentActivity.filter((i) => i.kind === "task_completed");
    // O mais recente de todos os eventos (marcado agora).
    expect(recentActivity.filter((i) => i.kind !== "login")[0]).toMatchObject({
      kind: "task_completed",
      student: { firstName: "Diana", lastName: "Costa" },
      cohort: { id: web.id, name: web.name },
      assignment: { id: setup.id, title: "Install Node.js and VS Code" },
    });
    expect(done.every((i) => i.assignment && i.cohort)).toBe(true);
    // Todos os eventos trazem a turma (ou null), não só os novos.
    expect(recentActivity.every((i) => i.cohort === null || typeof i.cohort.name === "string")).toBe(true);
  });
});
