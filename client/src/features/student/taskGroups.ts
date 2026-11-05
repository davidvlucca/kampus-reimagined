import { dueGroup, type DueGroup, type Task } from "@kampus/shared";

export interface TaskGroup {
  id: DueGroup;
  label: string;
  tasks: Task[];
}

const GROUPS: { id: DueGroup; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "later", label: "Later" },
  { id: "none", label: "No date" },
];

/**
 * As tarefas por fazer agrupadas pelo prazo (sem os grupos vazios) e as feitas à parte.
 * Dentro de cada grupo fica a ordem da API (prazo mais perto primeiro).
 */
export function groupTasks(tasks: Task[], now: Date = new Date()): { groups: TaskGroup[]; done: Task[] } {
  const byGroup = new Map<DueGroup, Task[]>(GROUPS.map((g) => [g.id, []]));
  const done: Task[] = [];
  for (const task of tasks) {
    if (task.done) done.push(task);
    else byGroup.get(dueGroup(task.dueDate, now))?.push(task);
  }
  const groups = GROUPS.map((g) => ({ ...g, tasks: byGroup.get(g.id) ?? [] })).filter((g) => g.tasks.length > 0);
  return { groups, done };
}

/** "6 to do · 1 done". */
export function countSummary(open: number, done: number): string {
  return `${open} to do · ${done} done`;
}
