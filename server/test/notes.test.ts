import { NEW_NOTE_TITLE, type KeptNoteResponse, type Note } from "@kampus/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notes } from "../src/db/schema.ts";
import { setup, STUDENT_A, STUDENT_B } from "./helpers.ts";

let t: Awaited<ReturnType<typeof setup>>;
let a: string; // cookie do aluno A
let b: string; // cookie do aluno B

beforeAll(async () => {
  t = await setup();
  a = await t.login(STUDENT_A, "student");
  b = await t.login(STUDENT_B, "student");
});
afterAll(() => t.close());

/** O que o "New note" do client cria. */
const newNote = async (cookie: string) =>
  (await t.request<{ note: Note }>("POST", "/api/notes", { cookie, body: { title: NEW_NOTE_TITLE, body: "" } })).json.note;
const getNote = (cookie: string, id: string) => t.request<{ note: Note }>("GET", `/api/notes/${id}`, { cookie });
const cleanup = (cookie: string, id: string) => t.request<KeptNoteResponse>("DELETE", `/api/notes/${id}?onlyIfEmpty=1`, { cookie });

describe("limpeza automática de uma nota nova vazia (DELETE ?onlyIfEmpty=1)", () => {
  it("apaga a nota que ninguém mexeu (204)", async () => {
    const note = await newNote(a);
    expect((await cleanup(a, note.id)).status).toBe(204);
    expect((await getNote(a, note.id)).status).toBe(404);
  });

  it("não apaga a nota que outro separador já guardou: 200 com a nota como está", async () => {
    // Separador A cria a nota; o separador B abre-a e guarda; só depois A sai e tenta limpar.
    const note = await newNote(a);
    await t.request("PATCH", `/api/notes/${note.id}`, { cookie: a, body: { body: "Room 2.14 at 9:00" } });
    const res = await cleanup(a, note.id);
    expect(res.status).toBe(200);
    expect(res.json.deleted).toBe(false);
    expect(res.json.note).toMatchObject({ id: note.id, title: NEW_NOTE_TITLE, body: "Room 2.14 at 9:00" });
    expect((await getNote(a, note.id)).json.note.body).toBe("Room 2.14 at 9:00");
  });

  it("também fica se só o título mudou", async () => {
    const note = await newNote(a);
    await t.request("PATCH", `/api/notes/${note.id}`, { cookie: a, body: { title: "Wifi" } });
    expect((await cleanup(a, note.id)).status).toBe(200);
    expect((await getNote(a, note.id)).status).toBe(200);
  });

  it("fica se foi editada, mesmo que tenha voltado a ficar vazia (outro separador está nela)", async () => {
    const note = await newNote(a);
    await t.request("PATCH", `/api/notes/${note.id}`, { cookie: a, body: { body: "draft" } });
    await t.request("PATCH", `/api/notes/${note.id}`, { cookie: a, body: { body: "" } });
    expect((await cleanup(a, note.id)).status).toBe(200);
    expect((await getNote(a, note.id)).status).toBe(200);
  });

  it("não apaga uma nota que não foi criada pelo New note", async () => {
    const note = (await t.request<{ note: Note }>("POST", "/api/notes", { cookie: a, body: { title: "Timetable", body: "" } })).json.note;
    expect((await cleanup(a, note.id)).status).toBe(200);
    expect((await getNote(a, note.id)).status).toBe(200);
  });

  it("a nota vazia de outro aluno nunca é apagada (404, como se não existisse)", async () => {
    const noteOfB = await newNote(b);
    const res = await cleanup(a, noteOfB.id);
    expect(res.status).toBe(404);
    expect(res.json).not.toHaveProperty("note");
    expect((await getNote(b, noteOfB.id)).status).toBe(200);
  });

  it("uma nota que já não existe dá 404", async () => {
    const note = await newNote(a);
    expect((await cleanup(a, note.id)).status).toBe(204);
    expect((await cleanup(a, note.id)).status).toBe(404);
  });

  it("recusa outro valor no onlyIfEmpty (400) e não apaga nada", async () => {
    const note = await newNote(a);
    expect((await t.request("DELETE", `/api/notes/${note.id}?onlyIfEmpty=true`, { cookie: a })).status).toBe(400);
    expect((await getNote(a, note.id)).status).toBe(200);
  });
});

describe("Delete pedido pelo aluno (sem onlyIfEmpty)", () => {
  it("apaga a nota mesmo com texto", async () => {
    const note = await newNote(a);
    await t.request("PATCH", `/api/notes/${note.id}`, { cookie: a, body: { body: "Keep me?" } });
    expect((await t.request("DELETE", `/api/notes/${note.id}`, { cookie: a })).status).toBe(204);
    expect((await getNote(a, note.id)).status).toBe(404);
  });

  it("não apaga a nota de outro aluno (404)", async () => {
    const noteOfB = await newNote(b);
    expect((await t.request("DELETE", `/api/notes/${noteOfB.id}`, { cookie: a })).status).toBe(404);
    expect((await getNote(b, noteOfB.id)).status).toBe(200);
  });
});

describe("notas antigas com caracteres de controlo (de antes de serem tirados)", () => {
  it("continuam editáveis: o PATCH com o corpo inteiro grava-o já limpo", async () => {
    const userId = await t.userId(STUDENT_A);
    // Direto na base, como ficou guardada antes da regra.
    const [old] = await t.db.insert(notes).values({ userId, title: "Old", body: "Line\u0001 one" }).returning();
    const res = await t.request<{ note: Note }>("PATCH", `/api/notes/${old!.id}`, { cookie: a, body: { body: "Line\u0001 one, more" } });
    expect(res.status).toBe(200);
    expect(res.json.note.body).toBe("Line one, more");
  });
});
