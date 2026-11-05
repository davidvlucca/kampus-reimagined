import { DATE_INPUT_MAX, DATE_INPUT_MIN, type Task } from "@kampus/shared";
import { CalendarDays, ChevronDown, ListTodo, PartyPopper, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { errorMessage, fieldErrors } from "../../api/client.ts";
import { useCreateTask, useTasks } from "../../api/hooks.ts";
import { Button, Card, CardBody, EmptyState, ErrorState, PageHeader, SkeletonList, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";
import { TaskItem } from "./TaskItem.tsx";
import { countSummary, groupTasks, type TaskGroup } from "./taskGroups.ts";

// A cor do título do grupo só reforça: o texto ("Overdue", "Today") já diz o estado.
const GROUP_TONE: Record<TaskGroup["id"], string> = {
  overdue: "text-danger",
  today: "text-warning",
  week: "text-muted",
  later: "text-muted",
  none: "text-muted",
};

const headingClass = "text-xs font-semibold tracking-wider uppercase";

export function TasksPage() {
  const tasks = useTasks("all");
  const titleRef = useRef<HTMLInputElement>(null);
  const { groups, done } = groupTasks(tasks.data ?? []);
  const openCount = groups.reduce((n, g) => n + g.tasks.length, 0);
  const summary = tasks.data ? countSummary(openCount, done.length) : undefined;
  const announcement = useChangeAnnouncement(summary);

  return (
    <>
      {/* Sem a descrição: no telemóvel empurrava a lista para fora do primeiro ecrã. */}
      <PageHeader
        title="Tasks"
        className="mb-4 flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:items-baseline"
        actions={summary && <p className="text-sm text-muted tabular-nums">{summary}</p>}
      />

      <CreateTaskForm titleRef={titleRef} />

      {/* Só se anuncia quando a contagem muda (marcar, apagar, criar), não ao abrir a página. */}
      <p aria-live="polite" aria-atomic className="sr-only">
        {announcement}
      </p>

      {tasks.isPending ? (
        <Card>
          <CardBody className="py-2">
            <SkeletonList rows={4} className="py-3" label="Loading tasks" />
          </CardBody>
        </Card>
      ) : tasks.isError ? (
        <Card>
          <CardBody className="py-2">
            <ErrorState message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} />
          </CardBody>
        </Card>
      ) : (
        // [data-task-list]: o TaskItem procura aqui para onde levar o foco quando a linha sai.
        <div data-task-list className="flex flex-col gap-5">
          {tasks.data.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ListTodo aria-hidden />}
                title="No tasks yet"
                description="Add your first task above, like picking up your student card or setting up your laptop."
                action={
                  <Button size="sm" onClick={() => titleRef.current?.focus()} icon={<Plus aria-hidden className="size-4" />}>
                    Add a task
                  </Button>
                }
              />
            </Card>
          ) : (
            groups.length === 0 && (
              <Card>
                <EmptyState
                  icon={<PartyPopper aria-hidden />}
                  title="All done!"
                  description="You've finished every task. Nice work."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => titleRef.current?.focus()}>
                      Add another task
                    </Button>
                  }
                />
              </Card>
            )
          )}
          {groups.map((group) => (
            <TaskGroupSection key={group.id} group={group} />
          ))}
          {done.length > 0 && <DoneSection tasks={done} />}
        </div>
      )}
    </>
  );
}

/** ", 2 tasks" para o leitor de ecrã; à vista fica " · 2". */
function GroupCount({ n }: { n: number }) {
  return (
    <>
      <span aria-hidden> · {n}</span>
      <span className="sr-only">
        , {n} {n === 1 ? "task" : "tasks"}
      </span>
    </>
  );
}

function TaskList({ tasks, id }: { tasks: Task[]; id?: string }) {
  return (
    <Card id={id}>
      <CardBody className="py-1">
        <ul className="divide-y divide-line">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} actions />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function TaskGroupSection({ group }: { group: TaskGroup }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={cn(headingClass, "mb-2", GROUP_TONE[group.id])}>
        {group.label}
        <GroupCount n={group.tasks.length} />
      </h2>
      <TaskList tasks={group.tasks} />
    </section>
  );
}

/**
 * As feitas começam fechadas: o que interessa é o que falta. A lista só existe aberta
 * (aria-controls só nesse caso): escondida com `hidden`, o foco podia cair numa caixa invisível.
 */
function DoneSection({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <section>
      <h2 className={cn(headingClass, "mb-2 text-success")}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((v) => !v)}
          className="-mx-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 uppercase hover:bg-success-soft sm:min-h-9"
        >
          Done
          <GroupCount n={tasks.length} />
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      {open && <TaskList tasks={tasks} id={listId} />}
    </section>
  );
}

/** O texto a anunciar: vazio ao carregar, depois o novo valor sempre que muda. */
function useChangeAnnouncement(value: string | undefined): string {
  const previous = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (value === undefined) return;
    if (previous.current !== undefined && value !== previous.current) setMessage(value.replace(" · ", ", "));
    previous.current = value;
  }, [value]);
  return message;
}

/**
 * Uma linha só: título, chip "Date" (abre o campo de data nativo) e "Add task".
 * A validação, os erros e os toasts são os de antes.
 */
function CreateTaskForm({ titleRef }: { titleRef: RefObject<HTMLInputElement | null> }) {
  const toast = useToast();
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useSubmitLock();
  const dateRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const titleErrorId = errors.title ? `${id}-title-error` : undefined;
  const dateErrorId = errors.dueDate ? `${id}-date-error` : undefined;

  // Com um erro da data (vindo da API) o campo abre: fechado, não havia onde o corrigir.
  const dateVisible = showDate || Boolean(errors.dueDate);

  const openDate = () => {
    setShowDate(true);
    requestAnimationFrame(() => {
      const input = dateRef.current;
      input?.focus();
      // Abre logo o calendário onde o browser deixa; onde não deixa, o campo fica focado.
      try {
        input?.showPicker();
      } catch {
        /* sem showPicker ou sem gesto do utilizador: chega o foco */
      }
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setErrors({ title: "Give your task a title" });
      titleRef.current?.focus();
      return;
    }
    setErrors({});
    void lock(() =>
      create.mutateAsync({ title: trimmed, dueDate: dueDate || null }).then(
        () => {
          setTitle("");
          setDueDate("");
          setShowDate(false);
          toast({ title: "Task added", tone: "success" });
          titleRef.current?.focus();
        },
        (err: unknown) => {
          setErrors(fieldErrors(err));
          toast({ title: "Couldn't add the task", description: errorMessage(err), tone: "error" });
        },
      ),
    );
  };

  const bare = "min-w-0 bg-transparent text-base text-text placeholder:text-subtle focus:outline-hidden";

  return (
    <form onSubmit={submit} noValidate className="mb-6">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-xl border border-line-control bg-card p-1.5 shadow-card transition",
          "focus-within:border-kampus-blue focus-within:ring-3 focus-within:ring-kampus-blue/20",
          (errors.title || errors.dueDate) && "border-danger focus-within:border-danger focus-within:ring-danger/20",
        )}
      >
        <label htmlFor={`${id}-title`} className="sr-only">
          New task
        </label>
        <input
          ref={titleRef}
          id={`${id}-title`}
          placeholder="Add a task…"
          value={title}
          maxLength={120}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={titleErrorId}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(bare, "h-11 flex-1 basis-40 px-2.5")}
        />
        {dateVisible ? (
          // No telemóvel o campo de data vai para a linha de baixo: ao lado do título não cabia.
          <span className="flex max-sm:order-last max-sm:basis-full">
            <label htmlFor={`${id}-date`} className="sr-only">
              Due date (optional)
            </label>
            <input
              ref={dateRef}
              id={`${id}-date`}
              type="date"
              min={DATE_INPUT_MIN}
              max={DATE_INPUT_MAX}
              value={dueDate}
              aria-invalid={errors.dueDate ? true : undefined}
              aria-describedby={dateErrorId}
              onChange={(e) => setDueDate(e.target.value)}
              className={cn(bare, "h-11 w-full rounded-lg border border-line px-2.5 text-sm sm:h-9 sm:w-40")}
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={openDate}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm font-medium text-kampus-navy transition hover:bg-kampus-blue-soft sm:h-9"
          >
            <CalendarDays aria-hidden className="size-4" />
            Date
          </button>
        )}
        <Button type="submit" loading={create.isPending} aria-label="Add task" icon={<Plus aria-hidden className="size-4" />} className="max-sm:size-11 max-sm:px-0">
          <span className="max-sm:hidden">Add task</span>
        </Button>
      </div>
      {errors.title && (
        <p id={titleErrorId} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {errors.title}
        </p>
      )}
      {errors.dueDate && (
        <p id={dateErrorId} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {errors.dueDate}
        </p>
      )}
    </form>
  );
}
