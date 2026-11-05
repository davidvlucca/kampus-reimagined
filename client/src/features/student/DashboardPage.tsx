import { ArrowRight, CircleCheck, ListTodo, Map as MapIcon, NotebookPen, Plus, RotateCcw } from "lucide-react";
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { Link } from "react-router";
import { errorMessage, fieldErrors } from "../../api/client.ts";
import { useCreateTask, useCurrentUser, useNotes, useTasks } from "../../api/hooks.ts";
import { Button, buttonClasses, Card, CardBody, CardHeader, EmptyState, ErrorState, Input, PageHeader, ProgressBar, Skeleton, SkeletonList, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { editedAt } from "../../lib/format.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";
import { excerpt } from "./noteText.ts";
import { Pomodoro } from "./Pomodoro.tsx";
import { TaskItem } from "./TaskItem.tsx";

const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const linkClass = "inline-flex items-center gap-1 text-sm font-semibold text-kampus-blue hover:underline";

/**
 * O dashboard com a silhueta de 2023: as tarefas a toda a largura em cima, as notas e o
 * Pomodoro lado a lado em baixo. A visita deixou de ter cartão próprio: é a última linha da lista.
 */
export function DashboardPage() {
  const user = useCurrentUser();
  const [today] = useState(() => longDate.format(new Date()));
  const tourDone = Boolean(user.tourCompletedAt);

  return (
    <>
      <PageHeader title={`Hi ${user.firstName}!`} description={today} />

      <div className="flex flex-col gap-6">
        <TasksCard tourDone={tourDone} />
        {/* Sem lg: notas e Pomodoro um por baixo do outro (a mesma ordem do telemóvel). */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <RecentNotes />
          <Pomodoro />
        </div>
      </div>
    </>
  );
}

function TasksCard({ tourDone }: { tourDone: boolean }) {
  const tasks = useTasks("open");
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader title="Your tasks" icon={<ListTodo aria-hidden />} className="flex-wrap" action={<Progress tourDone={tourDone} />} />
      <CardBody className="flex flex-col gap-2 pb-0">
        <QuickAddTask titleRef={titleRef} />
        {/* data-task-list fica só na lista: o foco de uma tarefa que sai não deve ir parar ao campo. */}
        <div data-task-list>
          {tasks.isPending ? (
            <SkeletonList rows={3} className="py-3" label="Loading tasks" />
          ) : tasks.isError ? (
            <ErrorState message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} />
          ) : tasks.data.length === 0 ? (
            <EmptyState
              icon={<ListTodo aria-hidden />}
              title="You're all caught up"
              description="No tasks left to do."
              action={
                <Button variant="secondary" size="sm" icon={<Plus aria-hidden className="size-4" />} onClick={() => titleRef.current?.focus()}>
                  Add a task
                </Button>
              }
              className="py-6"
            />
          ) : null}
          <ul className="divide-y divide-line">
            {tasks.data?.slice(0, 3).map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
            <TourRow done={tourDone} />
          </ul>
        </div>
      </CardBody>
      <div className="mx-5 flex justify-center border-t border-line py-4 sm:justify-end">
        <Link to="/app/tasks" className={linkClass}>
          See all tasks
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </Card>
  );
}

/** As tarefas mais a visita, como no antigo cartão de progresso (sem o "Week 1", que seria inventado). */
function Progress({ tourDone }: { tourDone: boolean }) {
  const tasks = useTasks("all");
  // No telemóvel passa para a linha de baixo, a toda a largura.
  const box = "flex w-full flex-col gap-1.5 sm:mt-1 sm:w-56";
  if (tasks.isPending) {
    return (
      <div role="status" className={box}>
        <span className="sr-only">Loading progress</span>
        <Skeleton className="h-4 w-32 sm:self-end" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    );
  }
  // O erro já aparece na lista, por baixo: aqui não se repete.
  if (tasks.isError) return null;
  const total = tasks.data.length + 1;
  const done = tasks.data.filter((t) => t.done).length + (tourDone ? 1 : 0);
  return (
    <div className={box}>
      <p className="text-sm text-muted sm:text-end">
        <span className="font-semibold text-kampus-navy">
          {done} of {total}
        </span>{" "}
        steps done
      </p>
      <ProgressBar value={done} max={total} label="Your progress" className="h-1.5" />
    </div>
  );
}

/** Só o título: o prazo põe-se na página de tarefas. Mesmas regras do formulário de lá. */
function QuickAddTask({ titleRef }: { titleRef: RefObject<HTMLInputElement | null> }) {
  const toast = useToast();
  const create = useCreateTask();
  const [title, setTitle] = useState("");
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
      create.mutateAsync({ title: trimmed, dueDate: null }).then(
        () => {
          setTitle("");
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
    <form onSubmit={submit} noValidate className="flex items-start gap-2">
      <Input
        ref={titleRef}
        label="New task"
        hideLabel
        placeholder="Add a task…"
        value={title}
        maxLength={120}
        error={errors.title}
        onChange={(e) => setTitle(e.target.value)}
        wrapperClassName="flex-1"
      />
      <Button type="submit" aria-label="Add task" title="Add task" loading={create.isPending} icon={<Plus aria-hidden className="size-5" />} className="w-11 px-0" />
    </form>
  );
}

/** A visita como última linha da lista (era um cartão com gradiente à parte). */
function TourRow({ done }: { done: boolean }) {
  if (done) {
    return (
      <li className="flex flex-wrap items-center gap-3 py-3">
        <CircleCheck aria-hidden className="size-5 shrink-0 text-success" />
        <span className="min-w-0 flex-1 text-muted">Campus tour done</span>
        <Link to="/app/tour" className={linkClass}>
          <RotateCcw aria-hidden className="size-4" />
          Take it again
        </Link>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-kampus-sky-soft text-kampus-blue">
        <MapIcon aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-[min(100%,8rem)] flex-1 flex-col">
        <span className="font-medium text-text">Take the campus tour</span>
        <span className="text-xs text-muted">About 5 minutes</span>
      </div>
      <Link to="/app/tour" className={buttonClasses({ variant: "secondary", size: "sm" })}>
        Start the tour
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </li>
  );
}

function RecentNotes() {
  const notes = useNotes();
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Latest notes"
        icon={<NotebookPen aria-hidden />}
        action={
          <div className="flex shrink-0 items-center gap-4">
            <Link to="/app/notes" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Plus aria-hidden className="size-4" />
              New note
            </Link>
            <Link to="/app/notes" className={linkClass + " max-sm:hidden"}>
              See all notes
            </Link>
          </div>
        }
      />
      <CardBody className="flex flex-1 flex-col gap-4">
        {notes.isPending ? (
          <SkeletonList rows={3} label="Loading notes" />
        ) : notes.isError ? (
          <ErrorState message={errorMessage(notes.error)} onRetry={() => notes.refetch()} />
        ) : notes.data.length === 0 ? (
          <EmptyState
            icon={<NotebookPen aria-hidden />}
            title="No notes yet"
            description="Jot down room numbers, names and anything else worth remembering."
            className="py-6"
          />
        ) : (
          <ul className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            {notes.data.slice(0, 3).map((note, i) => (
              // No telemóvel ficam duas: três notas empurravam o Pomodoro para muito longe.
              <li key={note.id} className={cn(i === 2 && "max-sm:hidden")}>
                <Link
                  to={`/app/notes/${note.id}`}
                  className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition hover:border-kampus-blue/40 hover:bg-kampus-blue-soft"
                >
                  <span className="clip-marks font-semibold break-words text-kampus-navy">{note.title}</span>
                  {note.body.trim() && <span className="line-clamp-2 text-sm break-words text-muted">{excerpt(note.body)}</span>}
                  {/* Em baixo: o cartão estica até à altura do Pomodoro. */}
                  <span className="mt-auto pt-2 text-xs text-muted">Edited {editedAt(note.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {notes.data && notes.data.length > 0 && (
          <Link to="/app/notes" className={linkClass + " self-center sm:hidden"}>
            See all notes
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </CardBody>
    </Card>
  );
}
