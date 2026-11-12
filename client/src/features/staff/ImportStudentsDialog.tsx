import type { StudentRow } from "@kampus/shared";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { api, ApiRequestError, errorMessage } from "../../api/client.ts";
import { useCohorts } from "../../api/hooks.ts";
import { Badge, Button, Dialog, Select, Textarea, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { MAX_IMPORT_ROWS, readImport, type ImportRow } from "./csvImport.ts";

type Result = { ok: true } | { ok: false; error: string };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Importar alunos de um CSV sem endpoint novo: pré-visualiza e valida cada linha no browser e
 * depois chama o POST de criar aluno uma vez por linha, por ordem. Uma linha recusada pela API
 * (email já usado, limite de alunos) fica com o erro e as outras seguem.
 */
export function ImportStudentsDialog({ open, onOpenChange, defaultCohortId = "" }: { open: boolean; onOpenChange: (open: boolean) => void; defaultCohortId?: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const cohorts = useCohorts();
  const [cohortId, setCohortId] = useState(defaultCohortId);
  const [text, setText] = useState("");
  const [results, setResults] = useState<Map<number, Result> | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = cohortId && text.trim() ? readImport(text, cohortId) : [];
  const tooMany = rows.length > MAX_IMPORT_ROWS;
  const ready = rows.filter((r) => r.input);
  const done = results !== null;

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setResults(null);
  };

  const importAll = async () => {
    if (busy || ready.length === 0 || tooMany) return;
    setBusy(true);
    const next = new Map<number, Result>();
    // Um de cada vez: em paralelo, cem argon2 ao mesmo tempo esgotavam a função na Vercel.
    for (const row of ready) {
      try {
        await api<{ student: StudentRow }>("/staff/students", { method: "POST", body: row.input });
        next.set(row.line, { ok: true });
      } catch (error) {
        next.set(row.line, { ok: false, error: errorMessage(error) });
        // A sessão caiu: as linhas seguintes falhavam todas. Para aqui; o pedido do fim leva ao login.
        if (error instanceof ApiRequestError && error.status === 401) {
          setResults(new Map(next));
          break;
        }
      }
      setResults(new Map(next));
    }
    // Uma só atualização no fim, em vez de uma por aluno.
    await qc.invalidateQueries({ queryKey: ["staff"] });
    setBusy(false);
    const added = [...next.values()].filter((r) => r.ok).length;
    const failed = next.size - added;
    toast({
      title: added > 0 ? `${plural(added, "student")} added` : "No students added",
      description: failed > 0 ? `${plural(failed, "line")} couldn't be added. Check the list.` : "Share their temporary passwords with them.",
      tone: failed > 0 ? "error" : "success",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title="Import students from CSV"
      description="One student per line: first name, last name, email and a temporary password."
      className="sm:max-w-2xl"
      footer={
        done && !busy ? (
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={ready.length === 0 || tooMany} onClick={importAll}>
              {ready.length > 0 ? `Add ${plural(ready.length, "student")}` : "Add students"}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <Select label="Cohort" required value={cohortId} disabled={busy || done} hint="Everyone in the file joins this cohort." onChange={(e) => setCohortId(e.target.value)}>
          <option value="" disabled>
            {cohorts.isPending ? "Loading cohorts…" : "Choose a cohort"}
          </option>
          {cohorts.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-file" className="text-sm font-medium text-kampus-navy">
            CSV file
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            disabled={busy || done}
            onChange={onFile}
            className="min-h-11 text-sm text-muted file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-line-strong file:bg-card file:px-4 file:font-semibold file:text-kampus-navy"
          />
        </div>
        <Textarea
          label="Or paste the lines"
          value={text}
          disabled={busy || done}
          placeholder={"first name,last name,email,password\nAna,Silva,ana.silva@example.com,Welcome2026"}
          hint="A first line with the column names is skipped."
          onChange={(e) => {
            setText(e.target.value);
            setResults(null);
          }}
          className="font-mono text-sm"
        />

        {text.trim() && !cohortId && <p className="text-sm text-muted">Choose a cohort to check the lines.</p>}
        {tooMany && (
          <p role="alert" className="text-sm font-medium text-danger">
            That's {rows.length} lines. Import up to {MAX_IMPORT_ROWS} at a time.
          </p>
        )}
        {rows.length > 0 && !tooMany && <Preview rows={rows} results={results} />}
      </div>
    </Dialog>
  );
}

function Preview({ rows, results }: { rows: ImportRow[]; results: Map<number, Result> | null }) {
  const invalid = rows.filter((r) => r.error).length;
  return (
    <section aria-labelledby="import-preview-title" className="flex flex-col gap-2">
      <h3 id="import-preview-title" className="text-sm font-semibold">
        {plural(rows.length - invalid, "line")} ready{invalid > 0 && `, ${invalid} with problems`}
      </h3>
      <ul aria-live="polite" className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {rows.map((row) => {
          const result = results?.get(row.line);
          const error = row.error ?? (result && !result.ok ? result.error : null);
          return (
            <li key={row.line} className="flex items-start gap-3 px-3 py-2 text-sm">
              <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", error ? "text-danger" : "text-success")}>{error ? <CircleAlert aria-hidden /> : <CircleCheck aria-hidden />}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-text">
                  <span className="text-subtle">Line {row.line}: </span>
                  {[row.firstName, row.lastName].filter(Boolean).join(" ") || "No name"}
                  {row.email && <span className="text-muted"> · {row.email}</span>}
                </p>
                {error && <p className="text-xs font-medium text-danger">{error}</p>}
              </div>
              {result?.ok && <Badge tone="success">Added</Badge>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
