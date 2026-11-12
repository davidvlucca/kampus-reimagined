import { createStudentSchema, type CreateStudentInput } from "@kampus/shared";

// O "Import CSV" do staff, só no browser: lê o ficheiro, valida cada linha com o mesmo Zod da
// API e depois cria um aluno de cada vez pelo POST /api/staff/students que já existe.

/** Mais do que isto de uma vez não faz sentido numa turma (e cada aluno custa um argon2 no servidor). */
export const MAX_IMPORT_ROWS = 100;

/** Lê um CSV simples: vírgula ou ponto e vírgula, aspas com "" lá dentro, linhas vazias ignoradas. */
export function parseCsv(text: string): string[][] {
  return splitCsv(text).filter(notEmpty);
}

const notEmpty = (row: string[]) => row.some((c) => c !== "");

/** Todas as linhas, vazias incluídas: o número da linha no ficheiro é o índice. */
function splitCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  // O Excel em português grava com ponto e vírgula.
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

export interface ImportRow {
  /** A linha no ficheiro (1 = a primeira), para quem corrige saber onde ir. */
  line: number;
  firstName: string;
  lastName: string;
  email: string;
  /** null se a linha está pronta a enviar. */
  error: string | null;
  input: CreateStudentInput | null;
}

const FIELD_LABEL: Record<string, string> = { firstName: "First name", lastName: "Last name", email: "Email", password: "Password", cohortId: "Cohort" };

/**
 * As linhas do ficheiro, validadas: "first name, last name, email, password". Uma primeira linha
 * com "email" é o cabeçalho e salta-se. Emails repetidos no ficheiro ficam com erro (a API
 * recusava o segundo).
 */
export function readImport(text: string, cohortId: string): ImportRow[] {
  // O número conta-se antes de tirar as linhas em branco, para bater com o que se vê no ficheiro.
  const rows = splitCsv(text)
    .map((cells, i) => ({ cells, line: i + 1 }))
    .filter((r) => notEmpty(r.cells));
  const hasHeader = rows[0]?.cells.some((c) => c.toLowerCase().replace(/\s/g, "") === "email") ?? false;
  const seen = new Set<string>();
  return rows.slice(hasHeader ? 1 : 0).map(({ cells, line }) => {
    const [firstName = "", lastName = "", email = "", password = ""] = cells;
    const base = { line, firstName, lastName, email };
    if (cells.length < 4) return { ...base, error: "Needs 4 columns: first name, last name, email, password", input: null };
    const parsed = createStudentSchema.safeParse({ firstName, lastName, email, password, cohortId });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      const field = typeof issue.path[0] === "string" ? FIELD_LABEL[issue.path[0]] : undefined;
      return { ...base, error: field ? `${field}: ${issue.message}` : issue.message, input: null };
    }
    if (seen.has(parsed.data.email)) return { ...base, error: "Email: Already in this file", input: null };
    seen.add(parsed.data.email);
    return { ...base, error: null, input: parsed.data };
  });
}
