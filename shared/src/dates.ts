// Prazos das tarefas. O prazo é uma data sem hora (YYYY-MM-DD), por isso compara-se
// com a data LOCAL de hoje. Usar UTC aqui dava "Overdue" a quem está a oeste de
// Greenwich à noite, e "Due today" no dia errado a quem está a leste.

export type DeadlineKind = "overdue" | "today" | "upcoming";

/** A unidade do texto: em dias o texto já diz o dia; em semanas ou mais já não. */
export type DeadlineUnit = "day" | "week" | "month" | "year";

export interface DeadlineStatus {
  kind: DeadlineKind;
  /** Dias até ao prazo (negativo se já passou). */
  days: number;
  unit: DeadlineUnit;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A data local de `date` no formato YYYY-MM-DD. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Converte YYYY-MM-DD num número de dias absoluto (sem fusos nem mudança de hora). */
function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / DAY_MS);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return dayNumber(toKey) - dayNumber(fromKey);
}

/** YYYY-MM-DD que existe no calendário (2026-02-31 não). */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  // setUTCFullYear e não Date.UTC: este lê os anos 0-99 como 1900-1999.
  const date = new Date(0);
  date.setUTCFullYear(y ?? 0, (m ?? 1) - 1, d ?? 1);
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d;
}

const plural = (n: number, unit: string) => `${n} ${n === 1 ? unit : `${unit}s`}`;

/**
 * "3 days", "2 weeks", "4 months", "2 years". Até 14 dias conta-se em dias; depois a
 * contagem exata deixa de ajudar ("2498 days") e arredonda-se para a unidade seguinte.
 */
function span(abs: number): { unit: DeadlineUnit; text: string } {
  if (abs <= 14) return { unit: "day", text: plural(abs, "day") };
  if (abs < 60) return { unit: "week", text: plural(Math.round(abs / 7), "week") };
  if (abs < 365) return { unit: "month", text: plural(Math.max(2, Math.round(abs / 30.44)), "month") };
  return { unit: "year", text: plural(Math.max(1, Math.round(abs / 365.25)), "year") };
}

/** O estado do prazo, ou null se `dueDate` não for uma data válida (não rebenta a página). */
export function deadlineStatus(dueDate: string, now: Date = new Date()): DeadlineStatus | null {
  if (!isDateKey(dueDate)) return null;
  const days = daysBetween(localDateKey(now), dueDate);
  if (days === 0) return { kind: "today", days, unit: "day", label: "Due today" };
  if (days === 1) return { kind: "upcoming", days, unit: "day", label: "Due tomorrow" };
  if (days === -1) return { kind: "overdue", days, unit: "day", label: "Due yesterday" };
  const { unit, text } = span(Math.abs(days));
  return days < 0 ? { kind: "overdue", days, unit, label: `Overdue by ${text}` } : { kind: "upcoming", days, unit, label: `Due in ${text}` };
}

/** Soma dias a uma data YYYY-MM-DD (útil no seed e nos formulários). */
export function addDays(key: string, amount: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + amount));
  return date.toISOString().slice(0, 10);
}
