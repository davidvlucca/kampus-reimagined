// Rascunho de uma nota por guardar, no sessionStorage (por separador). Sem ele, o texto perdia-se
// quando a sessão expirava a meio (o RequireAuth desmonta o editor) ou a nota era apagada noutro
// separador. Guarda também o `seed` (o que o formulário tinha ao começar), para ao guardar mandar
// só os campos que o aluno mudou, como sem rascunho.

export interface NoteDraft {
  title: string;
  body: string;
  seed: { title: string; body: string };
}

const key = (noteId: string) => `kampus.noteDraft.${noteId}`;

export function loadDraft(noteId: string): NoteDraft | null {
  try {
    const raw = sessionStorage.getItem(key(noteId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<NoteDraft>;
    const ok = typeof v.title === "string" && typeof v.body === "string" && typeof v.seed?.title === "string" && typeof v.seed.body === "string";
    return ok ? (v as NoteDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(noteId: string, draft: NoteDraft) {
  try {
    sessionStorage.setItem(key(noteId), JSON.stringify(draft));
  } catch {
    // Sem storage (modo privado, cheio): o editor funciona na mesma, só sem rede de segurança.
  }
}

export function clearDraft(noteId: string) {
  try {
    sessionStorage.removeItem(key(noteId));
  } catch {
    // idem
  }
}
