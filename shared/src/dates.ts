// Prazos das tarefas. O prazo é uma data sem hora (YYYY-MM-DD), por isso compara-se
// com a data LOCAL de hoje. Usar UTC aqui dava "Overdue" a quem está a oeste de
// Greenwich à noite, e "Due today" no dia errado a quem está a leste.

export type DeadlineKind = "overdue" | "today" | "upcoming";

export interface DeadlineStatus {
  kind: DeadlineKind;
  /** Dias até ao prazo (negativo se já passou). */
  days: number;
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

export function deadlineStatus(dueDate: string, now: Date = new Date()): DeadlineStatus {
  const days = daysBetween(localDateKey(now), dueDate);
  if (days < 0) {
    const late = -days;
    return { kind: "overdue", days, label: `Overdue by ${late} ${late === 1 ? "day" : "days"}` };
  }
  if (days === 0) return { kind: "today", days, label: "Due today" };
  return { kind: "upcoming", days, label: `${days} ${days === 1 ? "day" : "days"} left` };
}

/** Soma dias a uma data YYYY-MM-DD (útil no seed e nos formulários). */
export function addDays(key: string, amount: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + amount));
  return date.toISOString().slice(0, 10);
}
