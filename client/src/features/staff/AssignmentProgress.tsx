import type { Assignment } from "@kampus/shared";
import { ProgressBar } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { formatDate } from "../../lib/format.ts";
import { DeadlineBadge } from "../student/DeadlineBadge.tsx";

// Peças partilhadas entre a página das tarefas da turma e o cartão do dashboard.

/** Prazo de uma tarefa da turma: só conta como "Done" quando todos os alunos a fizeram. */
export function AssignmentDeadline({ assignment }: { assignment: Pick<Assignment, "done" | "students" | "dueDate"> }) {
  const allDone = assignment.students > 0 && assignment.done >= assignment.students;
  return (
    <>
      <DeadlineBadge task={{ done: allDone, dueDate: assignment.dueDate }} />
      {assignment.dueDate && <span className="text-xs text-muted">Due {formatDate(assignment.dueDate, { short: true })}</span>}
    </>
  );
}

/** Barra de progresso com "12 of 20 done". */
export function AssignmentProgress({ assignment, className }: { assignment: Pick<Assignment, "title" | "done" | "students">; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <ProgressBar value={assignment.done} max={assignment.students} label={`${assignment.title}: students done`} />
      <p className="text-sm text-muted">
        {assignment.students === 0 ? "No students in this cohort yet" : `${assignment.done} of ${assignment.students} done`}
      </p>
    </div>
  );
}
