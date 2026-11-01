import type { StaffRef, Task } from "@kampus/shared";
import { CalendarX, Pencil, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorMessage, fieldErrors } from "../../api/client.ts";
import { useDeleteTask, useUpdateTask } from "../../api/hooks.ts";
import { Button, Checkbox, ConfirmDialog, Dialog, IconButton, Input, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { formatDate, fullName } from "../../lib/format.ts";
import { DeadlineBadge } from "./DeadlineBadge.tsx";

/** "From Marta Lopes · Program Manager"; "From staff" se a pessoa já não existir. */
function assignedByText(staff: StaffRef | null): string {
  if (!staff) return "From staff";
  return staff.title ? `From ${fullName(staff)} · ${staff.title}` : `From ${fullName(staff)}`;
}

/**
 * Uma tarefa. O estado da caixa vem de `task.done` (em 2023 vinha sempre "To do").
 * `actions` mostra editar e apagar (página de tarefas); sem elas fica compacta (dashboard).
 * As tarefas da turma (`source: "cohort"`) mostram quem as deu e nunca têm editar nem apagar.
 */
export function TaskItem({ task, actions = false }: { task: Task; actions?: boolean }) {
  const toast = useToast();
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isCohort = task.source === "cohort";

  const toggle = (done: boolean) =>
    update.mutate(
      { id: task.id, done },
      {
        onSuccess: () => toast({ title: done ? "Task done. Nice!" : "Task moved back to To do", tone: "success" }),
        onError: (e) => toast({ title: "Couldn't update the task", description: errorMessage(e), tone: "error" }),
      },
    );

  return (
    <li className="flex items-center gap-3 py-3">
      <Checkbox
        checked={task.done}
        onChange={(e) => toggle(e.target.checked)}
        className="min-w-0 flex-1"
        label={
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className={cn("min-w-0 break-words", task.done ? "text-subtle line-through" : "text-text")}>{task.title}</span>
              {(task.done || task.dueDate) && (
                <span className="flex flex-wrap items-center gap-2">
                  <DeadlineBadge task={task} />
                  {task.dueDate && !task.done && <span className="text-xs text-subtle">{formatDate(task.dueDate, { short: true })}</span>}
                </span>
              )}
            </span>
            {isCohort && <span className="text-xs text-muted">{assignedByText(task.assignedBy)}</span>}
          </span>
        }
      />
      {/* As tarefas da turma são do staff: o aluno só as marca como feitas. */}
      {actions && !isCohort && (
        <div className="flex shrink-0 items-center">
          <IconButton label={`Edit "${task.title}"`} icon={<Pencil aria-hidden />} onClick={() => setEditing(true)} />
          <IconButton label={`Delete "${task.title}"`} variant="danger" icon={<Trash2 aria-hidden />} onClick={() => setDeleting(true)} />
          {editing && <EditTaskDialog task={task} onClose={() => setEditing(false)} />}
          <DeleteTaskDialog task={task} open={deleting} onOpenChange={setDeleting} />
        </div>
      )}
    </li>
  );
}

function EditTaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateTask();
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [error, setError] = useState<string | undefined>();
  const formId = `edit-task-${task.id}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Required");
      return;
    }
    update.mutate(
      { id: task.id, title: trimmed, dueDate: dueDate || null },
      {
        onSuccess: () => {
          toast({ title: "Task updated", tone: "success" });
          onClose();
        },
        onError: (err) => {
          setError(fieldErrors(err).title);
          toast({ title: "Couldn't save the task", description: errorMessage(err), tone: "error" });
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input label="Title" value={title} maxLength={120} error={error} onChange={(e) => setTitle(e.target.value)} required />
        <div className="flex flex-col gap-2">
          <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} hint="Optional" />
          {dueDate && (
            <Button variant="ghost" size="sm" className="self-start" icon={<CalendarX aria-hidden className="size-4" />} onClick={() => setDueDate("")}>
              Remove due date
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

function DeleteTaskDialog({ task, open, onOpenChange }: { task: Task; open: boolean; onOpenChange: (open: boolean) => void }) {
  const toast = useToast();
  const remove = useDeleteTask();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this task?"
      description={`"${task.title}" will be deleted for good.`}
      confirmLabel="Delete task"
      onConfirm={async () => {
        try {
          await remove.mutateAsync(task.id);
          toast({ title: "Task deleted", tone: "success" });
        } catch (e) {
          toast({ title: "Couldn't delete the task", description: errorMessage(e), tone: "error" });
        }
      }}
    />
  );
}
