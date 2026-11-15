import { DATE_INPUT_MAX, DATE_INPUT_MIN, type StaffRef, type Task } from "@kampus/shared";
import { CalendarX, Lock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { errorMessage, fieldErrors, isNotFound } from "../../api/client.ts";
import { useDeleteTask, useUpdateTask } from "../../api/hooks.ts";
import { Button, Checkbox, ConfirmDialog, Dialog, IconButton, Input, Menu, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName } from "../../lib/format.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";
import { DeadlineBadge } from "./DeadlineBadge.tsx";

/** "From Marta Lopes · Program Manager"; "From staff" se a pessoa já não existir. */
function assignedByText(staff: StaffRef | null): string {
  if (!staff) return "From staff";
  return staff.title ? `From ${fullName(staff)} · ${staff.title}` : `From ${fullName(staff)}`;
}

/**
 * Uma linha que sai da lista com o foco lá dentro (marcada como feita, que passa para "Done",
 * ou apagada) deixava o foco no <body>. Passa para a caixa da linha seguinte ou da
 * anterior e, com a lista vazia, para a ação do estado vazio dentro de `[data-task-list]`.
 */
function useKeepFocusInList(rowRef: RefObject<HTMLLIElement | null>) {
  // Layout effect: a limpeza corre antes de o React tirar a linha do DOM, com o foco ainda nela.
  useLayoutEffect(() => {
    const row = rowRef.current;
    return () => {
      if (!row?.contains(document.activeElement)) return;
      const list = row.parentElement;
      const index = list ? Array.from(list.children).indexOf(row) : -1;
      const container = row.closest("[data-task-list]");
      requestAnimationFrame(() => {
        // Alguém já pôs o foco noutro sítio (um dialog, um clique): não se mexe.
        if (document.activeElement && document.activeElement !== document.body) return;
        const rows = list?.isConnected ? list.children : container?.querySelector("ul")?.children;
        const next = rows?.[index] ?? rows?.[index - 1];
        const target =
          next?.querySelector<HTMLElement>('input[type="checkbox"]') ??
          container?.querySelector<HTMLElement>("a[href], button:not([disabled])") ??
          (container instanceof HTMLElement ? container : null);
        target?.focus();
      });
    };
  }, [rowRef]);
}

/**
 * Uma tarefa. O estado da caixa vem de `task.done` (em 2023 vinha sempre "To do").
 * `actions` mostra editar e apagar (página de tarefas); sem elas fica compacta (dashboard).
 * As tarefas da turma (`source: "cohort"`) mostram quem as deu e nunca têm editar nem apagar.
 * Só a caixa marca a tarefa: com o título dentro do <label>, um clique para o ler marcava-a.
 */
export function TaskItem({ task, actions = false }: { task: Task; actions?: boolean }) {
  const toast = useToast();
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const isCohort = task.source === "cohort";
  useKeepFocusInList(rowRef);

  // mutateAsync e não os callbacks do mutate: a linha muda de grupo (ou sai do dashboard) e
  // desmonta antes da resposta, e os callbacks de um componente desmontado já não correm.
  const toggle = (done: boolean) =>
    update.mutateAsync({ id: task.id, done }).then(
      () => toast({ title: done ? "Task done. Nice!" : "Task back on your list", tone: "success" }),
      (e: unknown) => toast({ title: "Couldn't update the task", description: errorMessage(e), tone: "error" }),
    );

  return (
    // flex-wrap: com texto a 200% num ecrã de 320px o título ficava com 0px entre a caixa e o menu;
    // assim passa para a linha de baixo com a largura toda.
    <li ref={rowRef} className="flex flex-wrap items-center gap-3 py-3">
      {/* O rótulo (escondido) é o título; o padding alarga a zona de clique da caixa para 44px. */}
      <Checkbox checked={task.done} onChange={(e) => toggle(e.target.checked)} label={task.title} hideLabel className="-m-2.5 shrink-0 p-2.5" />
      <div className="flex min-w-[min(100%,8rem)] flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          {/* Escondido do leitor de ecrã: já o lê como rótulo da caixa. */}
          <span aria-hidden className={cn("clip-marks min-w-0 break-words", task.done ? "text-subtle line-through" : "text-text")}>
            {task.title}
          </span>
          {(task.done || task.dueDate) && (
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <DeadlineBadge task={task} withDate />
            </span>
          )}
        </div>
        {isCohort && (
          <span className="flex items-start gap-1 text-xs text-muted" title={actions ? COHORT_HINT : undefined}>
            <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
            <span className="min-w-0">
              {assignedByText(task.assignedBy)}
              {actions && <span className="sr-only">. {COHORT_HINT}.</span>}
            </span>
          </span>
        )}
      </div>
      {/* As tarefas da turma são do staff: o aluno só as marca como feitas. */}
      {actions && !isCohort && (
        <>
          <div className="ml-auto flex shrink-0 items-center max-sm:hidden">
            <IconButton label={`Edit "${task.title}"`} icon={<Pencil aria-hidden />} onClick={() => setEditing(true)} />
            <IconButton label={`Delete "${task.title}"`} variant="danger" icon={<Trash2 aria-hidden />} onClick={() => setDeleting(true)} />
          </div>
          {/* No telemóvel os dois botões (88px) partiam o título em duas linhas: ficam num menu. */}
          <Menu
            className="ml-auto shrink-0 sm:hidden"
            label={`More actions for "${task.title}"`}
            icon={<MoreVertical aria-hidden />}
            items={[
              { label: "Edit", icon: <Pencil aria-hidden />, onSelect: () => setEditing(true) },
              { label: "Delete", icon: <Trash2 aria-hidden />, tone: "danger", onSelect: () => setDeleting(true) },
            ]}
          />
          {editing && <EditTaskDialog task={task} onClose={() => setEditing(false)} />}
          <DeleteTaskDialog task={task} open={deleting} onOpenChange={setDeleting} />
        </>
      )}
    </li>
  );
}

const COHORT_HINT = "Set by staff, so you can only mark it as done";

/** Depois de mostrar os erros, o foco vai para o primeiro campo inválido do formulário. */
function focusFirstInvalid(form: HTMLFormElement | null) {
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

function EditTaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateTask();
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useSubmitLock();
  const formRef = useRef<HTMLFormElement>(null);
  const formId = `edit-task-${task.id}`;
  const showErrors = (next: Record<string, string>) => {
    flushSync(() => setErrors(next));
    focusFirstInvalid(formRef.current);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      showErrors({ title: "Give your task a title" });
      return;
    }
    setErrors({});
    void lock(() =>
      update.mutateAsync({ id: task.id, title: trimmed, dueDate: dueDate || null }).then(
        () => {
          toast({ title: "Task updated", tone: "success" });
          onClose();
        },
        (err: unknown) => {
          toast({ title: "Couldn't save the task", description: errorMessage(err), tone: "error" });
          // Apagada noutro separador: não há nada para editar (a lista já se atualiza).
          if (isNotFound(err)) return onClose();
          // Como no formulário de criar: cada campo mostra o seu erro (o título e a data).
          showErrors(fieldErrors(err));
        },
      ),
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
      <form ref={formRef} id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input label="Title" value={title} maxLength={120} error={errors.title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="flex flex-col gap-2">
          <Input
            label="Due date"
            type="date"
            min={DATE_INPUT_MIN}
            max={DATE_INPUT_MAX}
            value={dueDate}
            error={errors.dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            hint="Optional"
          />
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
