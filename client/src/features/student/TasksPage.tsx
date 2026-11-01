import type { TaskFilter } from "@kampus/shared";
import { CheckCheck, ListTodo, PartyPopper, Plus } from "lucide-react";
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { errorMessage, fieldErrors } from "../../api/client.ts";
import { useCreateTask, useTasks } from "../../api/hooks.ts";
import { Button, Card, CardBody, EmptyState, ErrorState, Input, PageHeader, SkeletonList, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";
import { TaskItem } from "./TaskItem.tsx";

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "To do" },
  { value: "done", label: "Done" },
];

export function TasksPage() {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const tasks = useTasks(filter);
  // Contagens a partir da lista completa (fica em cache).
  const all = useTasks("all");
  const counts: Record<TaskFilter, number | undefined> = {
    all: all.data?.length,
    open: all.data?.filter((t) => !t.done).length,
    done: all.data?.filter((t) => t.done).length,
  };
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <PageHeader title="Tasks" description="Everything you need to sort out in your first weeks." />

      <Card className="mb-6">
        <CardBody>
          <CreateTaskForm titleRef={titleRef} />
        </CardBody>
      </Card>

      <div role="group" aria-label="Filter tasks" className="mb-4 inline-flex max-w-full flex-wrap rounded-xl border border-line bg-card p-1 shadow-card">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition",
              filter === f.value
                ? // Alto contraste: o filtro ativo com as cores de seleção do sistema (o fundo azul desaparecia).
                  "bg-kampus-blue text-white forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none"
                : "text-kampus-navy hover:bg-kampus-blue-soft",
            )}
          >
            {f.label}
            {counts[f.value] !== undefined && (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", filter === f.value ? "bg-white/20" : "bg-surface text-muted")}>{counts[f.value]}</span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="py-2">
          {tasks.isPending ? (
            <SkeletonList rows={4} className="py-3" label="Loading tasks" />
          ) : tasks.isError ? (
            <ErrorState message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} />
          ) : tasks.data.length === 0 ? (
            <TasksEmpty filter={filter} hasTasks={(counts.all ?? 0) > 0} onCreate={() => titleRef.current?.focus()} onShowAll={() => setFilter("all")} />
          ) : (
            <ul className="divide-y divide-line">
              {tasks.data.map((task) => (
                <TaskItem key={task.id} task={task} actions />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function CreateTaskForm({ titleRef }: { titleRef: RefObject<HTMLInputElement | null> }) {
  const toast = useToast();
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useSubmitLock();

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

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Input
        ref={titleRef}
        label="New task"
        placeholder="e.g. Pick up your student card"
        value={title}
        maxLength={120}
        error={errors.title}
        onChange={(e) => setTitle(e.target.value)}
        wrapperClassName="flex-1"
      />
      <Input label="Due date (optional)" type="date" value={dueDate} error={errors.dueDate} onChange={(e) => setDueDate(e.target.value)} wrapperClassName="sm:w-48" />
      <Button type="submit" loading={create.isPending} icon={<Plus aria-hidden className="size-4" />} className="sm:mt-7">
        Add task
      </Button>
    </form>
  );
}

function TasksEmpty({ filter, hasTasks, onCreate, onShowAll }: { filter: TaskFilter; hasTasks: boolean; onCreate: () => void; onShowAll: () => void }) {
  if (filter === "done")
    return (
      <EmptyState
        icon={<CheckCheck aria-hidden />}
        title="Nothing done yet"
        description="Tick a task when you finish it and it shows up here."
        action={
          <Button variant="secondary" size="sm" onClick={onShowAll}>
            Show all tasks
          </Button>
        }
      />
    );
  if (filter === "open" && hasTasks)
    return (
      <EmptyState
        icon={<PartyPopper aria-hidden />}
        title="All done!"
        description="You've finished every task. Enjoy the free time."
        action={
          <Button variant="secondary" size="sm" onClick={onCreate}>
            Add another task
          </Button>
        }
      />
    );
  return (
    <EmptyState
      icon={<ListTodo aria-hidden />}
      title="No tasks yet"
      description="Add your first task above, like picking up your student card or setting up your laptop."
      action={
        <Button size="sm" onClick={onCreate} icon={<Plus aria-hidden className="size-4" />}>
          Add a task
        </Button>
      }
    />
  );
}
