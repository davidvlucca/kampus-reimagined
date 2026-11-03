import { localDateKey, type ActivityItem, type ActivityKind, type Assignment, type StaffOverview } from "@kampus/shared";
import { ClipboardList, Flag, GraduationCap, LogIn, Map as MapIcon, MapPinned, Sparkles, UserPlus, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useAssignments, useCurrentUser, useStaffOverview } from "../../api/hooks.ts";
import {
  Avatar,
  Badge,
  Button,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
  Skeleton,
  SkeletonList,
} from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName, timeAgo } from "../../lib/format.ts";
import { AssignmentDeadline } from "./AssignmentProgress.tsx";

const PENDING_PREVIEW = 6;
const ASSIGNMENTS_PREVIEW = 3;
// O Badge não quebra linha; com nomes de turma compridos e texto a 200% saía do cartão.
const wrapBadge = "max-w-full rounded-xl whitespace-normal break-words";
const linkClass = "inline-flex items-center gap-1 text-sm font-semibold text-kampus-blue hover:underline";

export function StaffDashboardPage() {
  const user = useCurrentUser();
  const overview = useStaffOverview();

  return (
    <>
      <PageHeader
        title={`Hi ${user.firstName}!`}
        description="Here's how your students are settling in."
        actions={
          <Link to="/staff/students?new=1" className={buttonClasses()}>
            <UserPlus aria-hidden className="size-4" />
            Add student
          </Link>
        }
      />

      {overview.isPending ? (
        <DashboardSkeleton />
      ) : overview.isError ? (
        <Card>
          <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} />
        </Card>
      ) : overview.data.totalStudents === 0 ? (
        <Card>
          <EmptyState
            icon={<Users aria-hidden />}
            title="No students yet"
            description="Add your first student and they'll show up here."
            action={
              <Link to="/staff/students?new=1" className={buttonClasses()}>
                <UserPlus aria-hidden className="size-4" />
                Add student
              </Link>
            }
          />
        </Card>
      ) : (
        <Overview data={overview.data} />
      )}
    </>
  );
}

function Overview({ data }: { data: StaffOverview }) {
  const tourDone = data.totalStudents - data.pendingTour.length;
  const tourPct = data.totalStudents > 0 ? Math.round((tourDone / data.totalStudents) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          Summary
        </h2>
        {/* Três números lado a lado mesmo no telemóvel; só com o texto muito grande passam a coluna. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,5.5rem),1fr))] gap-2 sm:gap-4">
          <Stat icon={<Users aria-hidden />} label="Students" value={String(data.totalStudents)} />
          <Stat icon={<MapPinned aria-hidden />} label="Took the campus tour" value={`${tourPct}%`} />
          <Stat icon={<GraduationCap aria-hidden />} label="Cohorts" value={String(data.byCohort.length)} />
        </div>
      </section>

      <section aria-labelledby="cohorts-title">
        <h2 id="cohorts-title" className="mb-3 text-lg font-semibold">
          Students by cohort
        </h2>
        {data.byCohort.length === 0 ? (
          <Card>
            <EmptyState icon={<GraduationCap aria-hidden />} title="No cohorts yet" />
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.byCohort.map(({ cohort, students, tourDone: done }) => (
              <li key={cohort.id}>
                <Card className="h-full">
                  <CardBody className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                      <h3 className="min-w-0 text-base font-semibold break-words">{cohort.name}</h3>
                      <Badge tone="blue" className={wrapBadge}>{students === 1 ? "1 student" : `${students} students`}</Badge>
                    </div>
                    <ProgressBar value={done} max={students} label={`${cohort.name}: tour progress`} />
                    <p className="text-sm text-muted">
                      {done} of {students} took the tour
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <OpenAssignments />

      {/* items-start: cada cartão com a sua altura (sem um bloco vazio ao lado da atividade). */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <PendingTour pending={data.pendingTour} />
        <RecentActivity items={data.recentActivity} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
      <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-kampus-blue-soft text-kampus-blue sm:grid [&_svg]:size-5">{icon}</span>
      <div className="flex min-w-0 flex-col-reverse">
        <p className="text-xs break-words text-muted sm:text-sm">{label}</p>
        <p className="font-display text-xl font-semibold text-kampus-navy sm:text-2xl">{value}</p>
      </div>
    </Card>
  );
}

function PendingTour({ pending }: { pending: StaffOverview["pendingTour"] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? pending : pending.slice(0, PENDING_PREVIEW);
  const listId = "pending-tour-list";

  return (
    <Card>
      <CardHeader icon={<MapIcon aria-hidden />} title={`Haven't taken the tour yet (${pending.length})`} />
      <CardBody>
        {pending.length === 0 ? (
          <EmptyState icon={<Sparkles aria-hidden />} title="Everyone took the tour" description="All your students have explored the campus." className="py-6" />
        ) : (
          <>
            {/* Num cartão estreito a turma passa para baixo do nome, que fica inteiro. */}
            <ul id={listId} className="@container flex flex-col divide-y divide-line">
              {visible.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1 @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-3">
                    <span className="min-w-0 font-medium break-words text-text">{fullName(s)}</span>
                    {s.cohort && (
                      <Badge tone="sky" className={wrapBadge}>
                        {s.cohort.name}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {pending.length > PENDING_PREVIEW && (
              <Button variant="ghost" size="sm" className="mt-3" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show less" : `Show all (${pending.length})`}
              </Button>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

interface TaskGroup {
  title: string;
  /** Uma tarefa por turma, com o mesmo título. */
  items: Assignment[];
  /** O prazo mais próximo das que ainda estão em aberto. */
  nextDue: string | null;
}

const isOpen = (a: Assignment) => a.done < a.students;

/**
 * A mesma tarefa dada a várias turmas aparece uma vez, com uma linha por turma.
 * Em aberto = ainda há alunos por a fazer. Os prazos mais próximos primeiro; sem prazo no fim.
 */
function openGroups(assignments: Assignment[]): TaskGroup[] {
  const byTitle = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const key = a.title.trim().toLocaleLowerCase();
    byTitle.set(key, [...(byTitle.get(key) ?? []), a]);
  }
  const groups: TaskGroup[] = [];
  for (const items of byTitle.values()) {
    const open = items.filter(isOpen);
    const first = open[0];
    if (!first) continue;
    const dues = open.flatMap((a) => (a.dueDate ? [a.dueDate] : [])).sort();
    groups.push({
      title: first.title,
      items: [...items].sort((a, b) => a.cohort.name.localeCompare(b.cohort.name)),
      nextDue: dues[0] ?? null,
    });
  }
  return groups
    .sort((a, b) => {
      if (a.nextDue === b.nextDue) return a.title.localeCompare(b.title);
      if (!a.nextDue) return 1;
      if (!b.nextDue) return -1;
      return a.nextDue < b.nextDue ? -1 : 1;
    })
    .slice(0, ASSIGNMENTS_PREVIEW);
}

function OpenAssignments() {
  const assignments = useAssignments();
  const groups = assignments.data ? openGroups(assignments.data) : [];

  return (
    <Card>
      <CardHeader
        icon={<ClipboardList aria-hidden />}
        title="Cohort tasks"
        description="Open tasks with the nearest due date."
        action={
          <Link to="/staff/assignments" className={linkClass + " mt-2 shrink-0"}>
            See all
            <span className="sr-only"> cohort tasks</span>
          </Link>
        }
      />
      <CardBody>
        {assignments.isPending ? (
          <SkeletonList rows={3} label="Loading cohort tasks" />
        ) : assignments.isError ? (
          <ErrorState message={errorMessage(assignments.error)} onRetry={() => assignments.refetch()} className="py-6" />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<ClipboardList aria-hidden />}
            title={
              assignments.data.length === 0
                ? "No cohort tasks yet"
                : assignments.data.every((a) => a.students > 0)
                  ? "Every cohort task is done"
                  : "No open cohort tasks"
            }
            description={assignments.data.length === 0 ? "Give a whole cohort a task and track who has done it." : undefined}
            action={
              <Link to="/staff/assignments?new=1" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                New task
              </Link>
            }
            className="py-6"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {groups.map((group) => (
              <li key={group.title} className="py-4 first:pt-0 last:pb-0">
                <TaskGroupRow group={group} />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function TaskGroupRow({ group }: { group: TaskGroup }) {
  const dueDate = group.items[0]?.dueDate ?? null;
  // O mesmo prazo em todas as turmas: mostra-se uma vez, junto ao título.
  const sameDue = group.items.every((a) => a.dueDate === dueDate);
  const total = group.items.reduce((acc, a) => ({ done: acc.done + a.done, students: acc.students + a.students }), { done: 0, students: 0 });

  return (
    <div className="@container">
      <div className="flex flex-col gap-1.5 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-4">
        <p className="clip-marks min-w-0 font-medium break-words text-text">{group.title}</p>
        {sameDue && (
          <div className="flex flex-wrap items-center gap-2 @lg:shrink-0">
            <AssignmentDeadline assignment={{ ...total, dueDate }} />
          </div>
        )}
      </div>
      <ul aria-label={`${group.title}, by cohort`} className="mt-3 flex flex-col gap-2.5">
        {group.items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2 @lg:w-64">
              <Badge tone="sky" className={wrapBadge}>
                {a.cohort.name}
              </Badge>
              {!sameDue && <AssignmentDeadline assignment={a} />}
            </div>
            <div className="flex min-w-[min(100%,9rem)] flex-1 items-center gap-3 @lg:max-w-96">
              <ProgressBar value={a.done} max={a.students} label={`${a.title}, ${a.cohort.name}: students done`} className="h-2 flex-1" />
              <span className="shrink-0 text-xs text-muted tabular-nums">{a.students === 0 ? "No students" : `${a.done} of ${a.students}`}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const activityIcon: Record<ActivityKind, ReactNode> = {
  login: <LogIn aria-hidden />,
  tour_completed: <Flag aria-hidden />,
  student_created: <UserPlus aria-hidden />,
};

// Cor por tipo: os logins ficam discretos, as visitas acabadas e os alunos novos sobressaem.
const activityTone: Record<ActivityKind, string> = {
  login: "bg-surface text-muted",
  tour_completed: "bg-success-soft text-success",
  student_created: "bg-kampus-blue-soft text-kampus-blue",
};

type LoginDay = "today" | "yesterday" | "earlier";
type ActivityRow = { type: "event"; item: ActivityItem } | { type: "logins"; day: LoginDay; items: [ActivityItem, ...ActivityItem[]] };

function loginDay(at: string, now: Date): LoginDay {
  const key = localDateKey(new Date(at));
  if (key === localDateKey(now)) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return key === localDateKey(yesterday) ? "yesterday" : "earlier";
}

/**
 * Dez "X logged in" seguidos não dizem nada: os logins juntam-se numa linha por dia
 * ("8 students logged in today"), no lugar do mais recente. Os outros eventos ficam como estão.
 */
function activityRows(items: ActivityItem[], now: Date = new Date()): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const byDay = new Map<LoginDay, Extract<ActivityRow, { type: "logins" }>>();
  for (const item of items) {
    if (item.kind !== "login") {
      rows.push({ type: "event", item });
      continue;
    }
    const day = loginDay(item.at, now);
    const existing = byDay.get(day);
    if (existing) {
      existing.items.push(item);
    } else {
      const row = { type: "logins" as const, day, items: [item] as [ActivityItem, ...ActivityItem[]] };
      byDay.set(day, row);
      rows.push(row);
    }
  }
  // Um login sozinho fica como um evento normal ("Nuno Barros logged in").
  return rows.map((row) => (row.type === "logins" && row.items.length === 1 ? { type: "event", item: row.items[0] } : row));
}

function activityText(item: ActivityItem): string {
  const name = fullName(item.student);
  if (item.kind === "login") return `${name} logged in`;
  if (item.kind === "tour_completed") return `${name} completed the campus tour`;
  return `${name} was added`;
}

/** "Ana Silva, Rui Costa and 6 more" */
function namesPreview(items: ActivityItem[], max = 3): string {
  const names = items.map((i) => fullName(i.student));
  if (names.length <= max) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

const DAY_TEXT: Record<LoginDay, string> = { today: "today", yesterday: "yesterday", earlier: "recently" };

function RecentActivity({ items }: { items: ActivityItem[] }) {
  const rows = activityRows(items);
  return (
    <Card>
      <CardHeader icon={<Sparkles aria-hidden />} title="Recent activity" />
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState title="Nothing yet" description="Logins and finished tours will show up here." className="py-6" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => {
              const item = row.type === "event" ? row.item : row.items[0];
              return (
                <li
                  key={row.type === "event" ? `${item.kind}-${item.student.id}-${item.at}` : `logins-${row.day}`}
                  className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4", activityTone[item.kind])}>{activityIcon[item.kind]}</span>
                  <div className="min-w-0 flex-1">
                    {row.type === "event" ? (
                      <p className="clip-marks text-sm break-words text-text">{activityText(item)}</p>
                    ) : (
                      <>
                        <p className="text-sm text-text">
                          <span className="font-semibold">{row.items.length} students</span> logged in {DAY_TEXT[row.day]}
                        </p>
                        <p className="clip-marks text-xs break-words text-muted">{namesPreview(row.items)}</p>
                      </>
                    )}
                    <time dateTime={item.at} className="text-xs text-subtle">
                      {row.type === "logins" ? `Most recent ${timeAgo(item.at)}` : timeAgo(item.at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading overview</span>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-21 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-[var(--radius-card)]" />
        <Skeleton className="h-72 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
