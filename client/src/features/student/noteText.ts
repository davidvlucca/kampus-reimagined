// Marcas de markdown no início de uma linha: títulos (#), citações (>), listas (-, *, +, 1.) e caixas ([ ]).
const LINE_MARKS = /^\s*(?:#{1,6}\s+|>\s*|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/;

/** Excerto de uma nota numa só linha: quebras de linha viram espaços e as marcas de lista e de título saem. */
export function excerpt(body: string, max = 160): string {
  const flat = body
    .split(/\r?\n/)
    .map((line) => line.replace(LINE_MARKS, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

/**
 * Só os campos que o utilizador mudou em relação ao que o formulário recebeu (`seed`).
 * Mandar sempre os dois fazia um separador antigo apagar o que outro guardou no outro campo.
 * O título vai sem espaços à volta, como a API o guarda.
 */
export function noteChanges(seed: { title: string; body: string }, title: string, body: string): { title?: string; body?: string } {
  const changes: { title?: string; body?: string } = {};
  if (title.trim() !== seed.title) changes.title = title.trim();
  if (body !== seed.body) changes.body = body;
  return changes;
}
