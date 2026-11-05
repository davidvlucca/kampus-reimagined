import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, clearUserDrafts, draftKey, loadDraft, saveDraft, type NoteDraft } from "./noteDraft.ts";

// Os testes do client correm sem DOM: um sessionStorage mínimo em memória.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const A = "user-a";
const B = "user-b";
const NOTE = "note-1";
const draft: NoteDraft = { title: "Wifi", body: "kampus-guest", seed: { title: "Untitled note", body: "" } };

beforeEach(() => vi.stubGlobal("sessionStorage", memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("rascunhos de notas por utilizador", () => {
  it("a chave leva o utilizador e a nota", () => {
    expect(draftKey(A, NOTE)).toBe("kampus.noteDraft.user-a.note-1");
    expect(draftKey(A, NOTE)).not.toBe(draftKey(B, NOTE));
  });

  it("o rascunho de A não aparece a B na mesma nota (sessão de A caiu e B entrou no separador)", () => {
    saveDraft(A, NOTE, draft);
    expect(loadDraft(A, NOTE)).toEqual(draft);
    expect(loadDraft(B, NOTE)).toBeNull();
  });

  it("um rascunho antigo, guardado só pelo id da nota, é ignorado", () => {
    sessionStorage.setItem(`kampus.noteDraft.${NOTE}`, JSON.stringify(draft));
    expect(loadDraft(A, NOTE)).toBeNull();
  });

  it("clearDraft só tira o rascunho daquele utilizador", () => {
    saveDraft(A, NOTE, draft);
    saveDraft(B, NOTE, draft);
    clearDraft(B, NOTE);
    expect(loadDraft(A, NOTE)).toEqual(draft);
    expect(loadDraft(B, NOTE)).toBeNull();
  });

  it("clearUserDrafts (Log out) tira todos os rascunhos do utilizador e deixa o resto", () => {
    saveDraft(A, "n1", draft);
    saveDraft(A, "n2", draft);
    saveDraft(B, "n1", draft);
    sessionStorage.setItem("kampus.other", "x");
    clearUserDrafts(A);
    expect(loadDraft(A, "n1")).toBeNull();
    expect(loadDraft(A, "n2")).toBeNull();
    expect(loadDraft(B, "n1")).toEqual(draft);
    expect(sessionStorage.getItem("kampus.other")).toBe("x");
  });

  it("um rascunho estragado conta como nenhum", () => {
    sessionStorage.setItem(draftKey(A, NOTE), "{not json");
    expect(loadDraft(A, NOTE)).toBeNull();
    sessionStorage.setItem(draftKey(A, NOTE), JSON.stringify({ title: "x" }));
    expect(loadDraft(A, NOTE)).toBeNull();
  });
});
