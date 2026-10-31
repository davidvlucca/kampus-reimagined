import { deadlineStatus, type DeadlineKind, type Task } from "@kampus/shared";
import { Badge, type BadgeTone } from "../../components/ui/index.ts";

const TONE: Record<DeadlineKind, BadgeTone> = { overdue: "danger", today: "warning", upcoming: "blue" };

/** Prazo de uma tarefa: "Due today", "3 days left", "Overdue by 2 days"; feitas mostram "Done". */
export function DeadlineBadge({ task }: { task: Pick<Task, "done" | "dueDate"> }) {
  if (task.done) return <Badge tone="success">Done</Badge>;
  if (!task.dueDate) return null;
  const status = deadlineStatus(task.dueDate);
  return <Badge tone={TONE[status.kind]}>{status.label}</Badge>;
}
