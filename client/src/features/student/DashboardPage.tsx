import { ArrowRight, Flag, ListTodo, Map as MapIcon, NotebookPen, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useCurrentUser, useNotes, useTasks } from "../../api/hooks.ts";
import { buttonClasses, Card, CardBody, CardHeader, EmptyState, ErrorState, ProgressBar, Skeleton, SkeletonList, PageHeader } from "../../components/ui/index.ts";
import { formatDate } from "../../lib/format.ts";
import { excerpt } from "./noteText.ts";
import { Pomodoro } from "./Pomodoro.tsx";
import { TaskItem } from "./TaskItem.tsx";

const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const linkClass = "inline-flex items-center gap-1 text-sm font-semibold text-kampus-blue hover:underline";

export function DashboardPage() {
  const user = useCurrentUser();
  const [today] = useState(() => longDate.format(new Date()));
  const tourDone = Boolean(user.tourCompletedAt);

  return (
    <>
      <PageHeader title={`Hi ${user.firstName}!`} description={today} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <WeekProgress tourDone={tourDone} />
          <UpcomingTasks />
        </div>
        <div className="flex flex-col gap-6">
          {tourDone ? (
            <Link to="/app/tour" className={linkClass + " self-start"}>
              <RotateCcw aria-hidden className="size-4" />
              Take the tour again
            </Link>
          ) : (
            <TourCard />
          )}
          <Pomodoro />
        </div>
        <div className="lg:col-span-2">
          <RecentNotes />
        </div>
      </div>
    </>
  );
}

function WeekProgress({ tourDone }: { tourDone: boolean }) {
  const tasks = useTasks("all");
  return (
    <Card>
      <CardHeader title="Week 1 progress" description="Your tasks plus the campus tour." icon={<Flag aria-hidden />} />
      <CardBody>
        {tasks.isPending ? (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Loading progress</span>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-2.5 w-full" />
          </div>
        ) : tasks.isError ? (
          <ErrorState message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} className="py-4" />
        ) : (
          (() => {
            const total = tasks.data.length + 1;
            const done = tasks.data.filter((t) => t.done).length + (tourDone ? 1 : 0);
            const pct = Math.round((done / total) * 100);
            return (
              <div className="flex flex-col gap-3">
                <p className="font-display text-3xl font-semibold text-kampus-navy">{pct}%</p>
                <ProgressBar value={done} max={total} label="Week 1 progress" />
                <p className="text-sm text-muted">
                  {done} of {total} steps done
                </p>
              </div>
            );
          })()
        )}
      </CardBody>
    </Card>
  );
}

function TourCard() {
  return (
    <div className="rounded-[var(--radius-card)] bg-kampus-gradient p-6 text-white shadow-card">
      <span className="grid size-10 place-items-center rounded-xl bg-white/15">
        <MapIcon aria-hidden className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-white">Take the campus tour</h2>
      <p className="mt-1 text-sm text-white/85">A short walk through the places you'll use every day. It only takes a few minutes.</p>
      <Link to="/app/tour" className={buttonClasses({ variant: "light", className: "mt-5" })}>
        Start the tour
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

function UpcomingTasks() {
  const tasks = useTasks("open");
  return (
    <Card>
      <CardHeader
        title="Next tasks"
        icon={<ListTodo aria-hidden />}
        action={
          <Link to="/app/tasks" className={linkClass + " mt-2 shrink-0"}>
            See all tasks
          </Link>
        }
      />
      <CardBody className="py-2">
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
              <Link to="/app/tasks" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <Plus aria-hidden className="size-4" />
                Add a task
              </Link>
            }
            className="py-6"
          />
        ) : (
          <ul className="divide-y divide-line">
            {tasks.data.slice(0, 4).map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function RecentNotes() {
  const notes = useNotes();
  return (
    <Card>
      <CardHeader
        title="Latest notes"
        icon={<NotebookPen aria-hidden />}
        action={
          <Link to="/app/notes" className={linkClass + " mt-2 shrink-0"}>
            See all notes
          </Link>
        }
      />
      <CardBody>
        {notes.isPending ? (
          <SkeletonList rows={3} label="Loading notes" />
        ) : notes.isError ? (
          <ErrorState message={errorMessage(notes.error)} onRetry={() => notes.refetch()} />
        ) : notes.data.length === 0 ? (
          <EmptyState
            icon={<NotebookPen aria-hidden />}
            title="No notes yet"
            description="Jot down room numbers, names and anything else worth remembering."
            action={
              <Link to="/app/notes" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <Plus aria-hidden className="size-4" />
                Write a note
              </Link>
            }
            className="py-6"
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {notes.data.slice(0, 3).map((note) => (
              <li key={note.id}>
                <Link
                  to={`/app/notes/${note.id}`}
                  className="flex h-full flex-col gap-1 rounded-xl border border-line bg-surface p-4 transition hover:border-kampus-blue/40 hover:bg-kampus-blue-soft"
                >
                  <span className="font-semibold break-words text-kampus-navy">{note.title}</span>
                  <span className="text-xs text-muted">{formatDate(note.updatedAt)}</span>
                  {note.body.trim() && <span className="line-clamp-2 text-sm text-muted">{excerpt(note.body)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
