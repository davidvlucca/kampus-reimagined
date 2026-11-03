import type { Assignment, Note, StaffOverview, StudentRow, Task } from "@kampus/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup, STAFF, STUDENT_A, STUDENT_B } from "./helpers.ts";

let t: Awaited<ReturnType<typeof setup>>;
let a: string; // cookie do aluno A
let b: string; // cookie do aluno B
let staff: string;
let taskOfB: Task;
let noteOfB: Note;

beforeAll(async () => {
  t = await setup();
  a = await t.login(STUDENT_A, "student");
  b = await t.login(STUDENT_B, "student");
  staff = await t.login(STAFF, "staff");
  // Uma tarefa pessoal: as da turma são partilhadas por A e B (estão na mesma turma).
  taskOfB = (await t.request<{ tasks: Task[] }>("GET", "/api/tasks", { cookie: b })).json.tasks.find((x) => x.source === "personal")!;
  noteOfB = (await t.request<{ notes: Note[] }>("GET", "/api/notes", { cookie: b })).json.notes[0]!;
});
afterAll(() => t.close());

describe("um aluno só vê e altera os próprios dados", () => {
  it("a lista de tarefas e de notas só traz as do próprio aluno", async () => {
    const tasksA = (await t.request<{ tasks: Task[] }>("GET", "/api/tasks", { cookie: a })).json.tasks;
    const notesA = (await t.request<{ notes: Note[] }>("GET", "/api/notes", { cookie: a })).json.notes;
    expect(tasksA.length).toBeGreaterThan(0);
    expect(tasksA.map((x) => x.id)).not.toContain(taskOfB.id);
    expect(notesA.map((x) => x.id)).not.toContain(noteOfB.id);
  });

  it("não lê a nota de outro aluno (404, como se não existisse)", async () => {
    expect((await t.request("GET", `/api/notes/${noteOfB.id}`, { cookie: a })).status).toBe(404);
  });

  it("não edita nem conclui a tarefa de outro aluno", async () => {
    const res = await t.request("PATCH", `/api/tasks/${taskOfB.id}`, { cookie: a, body: { done: !taskOfB.done, title: "hacked" } });
    expect(res.status).toBe(404);
    const after = (await t.request<{ tasks: Task[] }>("GET", "/api/tasks", { cookie: b })).json.tasks.find((x) => x.id === taskOfB.id)!;
    expect(after.title).toBe(taskOfB.title);
    expect(after.done).toBe(taskOfB.done);
  });

  it("não edita nem apaga a nota de outro aluno", async () => {
    expect((await t.request("PATCH", `/api/notes/${noteOfB.id}`, { cookie: a, body: { body: "hacked" } })).status).toBe(404);
    expect((await t.request("DELETE", `/api/notes/${noteOfB.id}`, { cookie: a })).status).toBe(404);
    expect((await t.request("GET", `/api/notes/${noteOfB.id}`, { cookie: b })).status).toBe(200);
  });

  it("não apaga a tarefa de outro aluno", async () => {
    expect((await t.request("DELETE", `/api/tasks/${taskOfB.id}`, { cookie: a })).status).toBe(404);
    const stillThere = (await t.request<{ tasks: Task[] }>("GET", "/api/tasks", { cookie: b })).json.tasks;
    expect(stillThere.map((x) => x.id)).toContain(taskOfB.id);
  });

  it("um id que não é UUID dá 404 (e não 500)", async () => {
    expect((await t.request("PATCH", "/api/tasks/123", { cookie: a, body: { done: true } })).status).toBe(404);
  });
});

describe("rotas de staff", () => {
  const staffRoutes: [string, string, unknown?][] = [
    ["GET", "/api/staff/overview"],
    ["GET", "/api/staff/students"],
    ["GET", "/api/cohorts"],
    ["POST", "/api/staff/students", { firstName: "X", lastName: "Y", email: "x@example.com", cohortId: "00000000-0000-4000-8000-000000000000", password: "Password1" }],
    ["PATCH", "/api/staff/students/00000000-0000-4000-8000-000000000000", { firstName: "X" }],
    ["DELETE", "/api/staff/students/00000000-0000-4000-8000-000000000000"],
    ["GET", "/api/staff/assignments"],
    ["GET", "/api/staff/assignments/00000000-0000-4000-8000-000000000000"],
    ["POST", "/api/staff/assignments", { cohortId: "00000000-0000-4000-8000-000000000000", title: "X" }],
    ["PATCH", "/api/staff/assignments/00000000-0000-4000-8000-000000000000", { title: "X" }],
    ["DELETE", "/api/staff/assignments/00000000-0000-4000-8000-000000000000"],
  ];

  it.each(staffRoutes)("aluno em %s %s recebe 403", async (method, path, body) => {
    expect((await t.request(method, path, { cookie: a, body })).status).toBe(403);
  });

  it.each(staffRoutes)("sem sessão, %s %s recebe 401", async (method, path, body) => {
    expect((await t.request(method, path, { body })).status).toBe(401);
  });

  it("staff não usa as rotas de aluno (tarefas, notas, contactos, visita)", async () => {
    for (const path of ["/api/tasks", "/api/notes", "/api/contacts"]) {
      expect((await t.request("GET", path, { cookie: staff })).status).toBe(403);
    }
    expect((await t.request("POST", "/api/tour/complete", { cookie: staff })).status).toBe(403);
  });

  it("staff não edita nem apaga outro staff pela rota de alunos", async () => {
    const otherStaff = await t.userId("rui.matos@example.com");
    expect((await t.request("PATCH", `/api/staff/students/${otherStaff}`, { cookie: staff, body: { firstName: "Hacked" } })).status).toBe(404);
    expect((await t.request("DELETE", `/api/staff/students/${otherStaff}`, { cookie: staff })).status).toBe(404);
    await t.login("rui.matos@example.com", "staff");
  });
});

describe("gestão de alunos pelo staff", () => {
  it("lista, cria, edita e apaga um aluno (as tarefas vão em cascata)", async () => {
    const list = await t.request<{ students: StudentRow[] }>("GET", "/api/staff/students", { cookie: staff });
    expect(list.json.students).toHaveLength(20);
    const cohortId = list.json.students[0]!.cohort!.id;

    const created = await t.request<{ student: StudentRow }>("POST", "/api/staff/students", {
      cookie: staff,
      body: { firstName: "New", lastName: "Student", email: "new.student@example.com", cohortId, password: "TempPass1" },
    });
    expect(created.status).toBe(201);
    const id = created.json.student.id;

    const dup = await t.request("POST", "/api/staff/students", {
      cookie: staff,
      body: { firstName: "Dup", lastName: "Licate", email: "NEW.student@example.com", cohortId, password: "TempPass1" },
    });
    expect(dup.status).toBe(409);

    const newCookie = await t.login("new.student@example.com", "student", "TempPass1");
    await t.request("POST", "/api/tasks", { cookie: newCookie, body: { title: "My task" } });

    const edited = await t.request<{ student: StudentRow }>("PATCH", `/api/staff/students/${id}`, {
      cookie: staff,
      body: { firstName: "Renamed" },
    });
    expect(edited.json.student.firstName).toBe("Renamed");
    // A tarefa que criou mais as 3 da turma.
    expect(edited.json.student.taskCount).toBe(4);

    expect((await t.request("DELETE", `/api/staff/students/${id}`, { cookie: staff })).status).toBe(204);
    // A sessão do aluno apagado também deixa de existir.
    expect((await t.request("GET", "/api/auth/me", { cookie: newCookie })).json).toEqual({ user: null });
  });

  it("uma nova password definida pelo staff termina as sessões abertas do aluno", async () => {
    const email = "hana.sato@example.com";
    const studentCookie = await t.login(email, "student");
    const id = await t.userId(email);
    const res = await t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { password: "ResetPass1" } });
    expect(res.status).toBe(200);
    expect((await t.request("GET", "/api/auth/me", { cookie: studentCookie })).json).toEqual({ user: null });
    await t.login(email, "student", "ResetPass1");
  });

  it("procura por nome e filtra por turma", async () => {
    const res = await t.request<{ students: StudentRow[] }>("GET", "/api/staff/students?q=diana%20cos", { cookie: staff });
    expect(res.json.students.map((s) => s.email)).toEqual([STUDENT_A]);

    const all = (await t.request<{ students: StudentRow[] }>("GET", "/api/staff/students", { cookie: staff })).json.students;
    const cohortId = all[0]!.cohort!.id;
    const filtered = (await t.request<{ students: StudentRow[] }>("GET", `/api/staff/students?cohortId=${cohortId}`, { cookie: staff })).json.students;
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((s) => s.cohort?.id === cohortId)).toBe(true);
  });

  it("overview conta alunos por turma e quem ainda não fez a visita", async () => {
    const res = await t.request<StaffOverview>("GET", "/api/staff/overview", { cookie: staff });
    expect(res.json.byCohort).toHaveLength(3);
    expect(res.json.totalStudents).toBe(20);
    expect(res.json.pendingTour.map((p) => p.firstName)).toContain("Diana");
    expect(res.json.recentActivity.length).toBeGreaterThan(0);
  });
});

describe("visita e tarefas do aluno", () => {
  it("concluir a visita fica guardado no utilizador", async () => {
    const res = await t.request<{ user: { tourCompletedAt: string | null } }>("POST", "/api/tour/complete", { cookie: a });
    expect(res.json.user.tourCompletedAt).not.toBeNull();
  });

  it("refazer a visita mantém a data da primeira conclusão", async () => {
    const first = await t.request<{ user: { tourCompletedAt: string } }>("POST", "/api/tour/complete", { cookie: a });
    const again = await t.request<{ user: { tourCompletedAt: string } }>("POST", "/api/tour/complete", { cookie: a });
    expect(again.json.user.tourCompletedAt).toBe(first.json.user.tourCompletedAt);
  });

  it("um prazo que não existe no calendário dá 400 (e não 500)", async () => {
    const res = await t.request("POST", "/api/tasks", { cookie: a, body: { title: "Bad date", dueDate: "2026-02-31" } });
    expect(res.status).toBe(400);
  });

  it("marcar e desmarcar uma tarefa guarda o estado certo (bug do checkbox de 2023)", async () => {
    const created = await t.request<{ task: Task }>("POST", "/api/tasks", { cookie: a, body: { title: "Fresh task", dueDate: "2026-11-05" } });
    expect(created.json.task.done).toBe(false);
    const id = created.json.task.id;

    const done = await t.request<{ task: Task }>("PATCH", `/api/tasks/${id}`, { cookie: a, body: { done: true } });
    expect(done.json.task.done).toBe(true);
    expect(done.json.task.completedAt).not.toBeNull();

    const undone = await t.request<{ task: Task }>("PATCH", `/api/tasks/${id}`, { cookie: a, body: { done: false } });
    expect(undone.json.task.done).toBe(false);
    expect(undone.json.task.completedAt).toBeNull();

    const open = (await t.request<{ tasks: Task[] }>("GET", "/api/tasks?status=open", { cookie: a })).json.tasks;
    expect(open.every((x) => !x.done)).toBe(true);
    expect(open.map((x) => x.id)).toContain(id);
  });
});

describe("o hash da password nunca sai na API", () => {
  it("nenhuma resposta desta bateria de testes contém o hash", async () => {
    // Percorre ainda as rotas de leitura, com cada perfil.
    for (const [cookie, paths] of [
      [a, ["/api/auth/me", "/api/tasks", "/api/notes", "/api/contacts"]],
      [staff, ["/api/auth/me", "/api/staff/overview", "/api/staff/students", "/api/cohorts", "/api/staff/assignments"]],
    ] as const) {
      for (const path of paths) await t.request("GET", path, { cookie });
    }
    // O autor de uma tarefa da turma vem de `users`: confirma que só saem as colunas públicas.
    const { assignments } = (await t.request<{ assignments: Assignment[] }>("GET", "/api/staff/assignments", { cookie: staff })).json;
    await t.request("GET", `/api/staff/assignments/${assignments[0]!.id}`, { cookie: staff });
    await t.request("PATCH", "/api/me", { cookie: a, body: { firstName: "Diana", lastName: "Costa" } });

    expect(t.seenBodies.length).toBeGreaterThan(30);
    for (const body of t.seenBodies) {
      expect(body).not.toMatch(/\$argon2/);
      expect(body).not.toMatch(/password_?hash/i);
    }
  });
});
