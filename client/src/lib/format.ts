const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "2 Nov 2026" a partir de um ISO ou de YYYY-MM-DD (este último lido como data local). */
export function formatDate(value: string, opts: { short?: boolean } = {}): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return (opts.short ? shortDate : dateFormat).format(date);
}

/** "3 hours ago", "yesterday"... */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
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
