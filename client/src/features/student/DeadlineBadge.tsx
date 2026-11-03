import { deadlineStatus, type DeadlineKind, type Task } from "@kampus/shared";
import { Badge, type BadgeTone } from "../../components/ui/index.ts";
import { formatDate } from "../../lib/format.ts";

const TONE: Record<DeadlineKind, BadgeTone> = { overdue: "danger", today: "warning", upcoming: "blue" };

/**
 * Prazo de uma tarefa: "Due today", "Due in 3 days", "Overdue by 2 weeks"; feitas mostram "Done".
 * Com `withDate`, a data ("1 Nov") só se vê quando o texto não a diz já (semanas ou mais);
 * em dias fica para o leitor de ecrã e na dica do rato. Uma data inválida não mostra nada.
 */
export function DeadlineBadge({ task, withDate = false }: { task: Pick<Task, "done" | "dueDate">; withDate?: boolean }) {
  if (task.done) return <Badge tone="success">Done</Badge>;
  if (!task.dueDate) return null;
  const status = deadlineStatus(task.dueDate);
  if (!status) return null;
  const date = formatDate(task.dueDate, { short: true });
  const badge = (
    <span title={withDate ? `Due ${date}` : undefined} className="inline-flex min-w-0">
      {/* Pode partir em duas linhas: com texto a 200% num ecrã de 320px não cabia. */}
      <Badge tone={TONE[status.kind]} className="whitespace-normal">
        {status.label}
        {withDate && status.unit === "day" && <span className="sr-only">, {date}</span>}
      </Badge>
    </span>
  );
  if (!withDate || status.unit === "day") return badge;
  return (
    <>
      {badge}
      <time dateTime={task.dueDate} className="text-xs text-subtle">
        {date}
      </time>
    </>
  );
}
