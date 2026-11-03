const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Um ISO ou YYYY-MM-DD (este lido como data local); null se não for uma data. */
function parseDate(value: string): Date | null {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "2 Nov 2026"; com `short`, "2 Nov" (com o ano só se não for o de `now`).
 * Uma data inválida dá "" (o Intl dava RangeError e rebentava a página inteira).
 */
export function formatDate(value: string, opts: { short?: boolean; now?: Date } = {}): string {
  const date = parseDate(value);
  if (!date) return "";
  const sameYear = date.getFullYear() === (opts.now ?? new Date()).getFullYear();
  return (opts.short && sameYear ? shortDate : dateFormat).format(date);
}

/** "3 hours ago", "yesterday"... */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const date = parseDate(iso);
  if (!date) return "";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Quando algo foi editado, sempre com a mesma regra: relativo na última semana
 * ("3 hours ago", "yesterday"), depois a data curta ("2 Nov", ou "2 Nov 2025").
 */
export function editedAt(iso: string, now: Date = new Date()): string {
  const date = parseDate(iso);
  if (!date) return "";
  return now.getTime() - date.getTime() < WEEK_MS ? timeAgo(iso, now) : formatDate(iso, { short: true, now });
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

// Por grafemas: `"🎓 Ana"[0]` é metade de um emoji (um carácter partido no avatar).
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** O primeiro carácter visível (emoji com modificadores, letra com acento combinado...). */
export function firstGrapheme(value: string): string {
  const text = value.trim();
  if (!text) return "";
  if (segmenter) return segmenter.segment(text)[Symbol.iterator]().next().value?.segment ?? "";
  return Array.from(text)[0] ?? "";
}

export function initials(firstName: string, lastName: string): string {
  return `${firstGrapheme(firstName)}${firstGrapheme(lastName)}`.toUpperCase();
}
