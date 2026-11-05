// Rascunho de uma nota por guardar, no sessionStorage (por separador). Sem ele, o texto perdia-se
// quando a sessão expirava a meio (o RequireAuth desmonta o editor) ou a nota era apagada noutro
// separador. Guarda também o `seed` (o que o formulário tinha ao começar), para ao guardar mandar
// só os campos que o aluno mudou, como sem rascunho.
// A chave leva o id do utilizador: se a sessão de A cai e B entra no mesmo separador, B não vê
// (nem copia para a conta dele com "Save as a new note") o rascunho de A.

export interface NoteDraft {
  title: string;
  body: string;
  seed: { title: string; body: string };
}

const PREFIX = "kampus.noteDraft.";

export const draftKey = (userId: string, noteId: string) => `${PREFIX}${userId}.${noteId}`;

export function loadDraft(userId: string, noteId: string): NoteDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(userId, noteId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<NoteDraft>;
    const ok = typeof v.title === "string" && typeof v.body === "string" && typeof v.seed?.title === "string" && typeof v.seed.body === "string";
    return ok ? (v as NoteDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, noteId: string, draft: NoteDraft) {
  try {
    sessionStorage.setItem(draftKey(userId, noteId), JSON.stringify(draft));
  } catch {
    // Sem storage (modo privado, cheio): o editor funciona na mesma, só sem rede de segurança.
  }
}

export function clearDraft(userId: string, noteId: string) {
  try {
    sessionStorage.removeItem(draftKey(userId, noteId));
  } catch {
    // idem
  }
}

/** Ao terminar sessão (Log out): os rascunhos deste utilizador saem do separador. */
export function clearUserDrafts(userId: string) {
  try {
    const mine = `${PREFIX}${userId}.`;
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(mine)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    // idem
  }
}
