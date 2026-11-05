import { deadlineStatus, localDateKey, type ActivityItem, type ActivityKind, type Assignment, type StaffCohort, type StudentRow } from "@kampus/shared";
import { Activity, AlertTriangle, ChevronRight, CircleCheck, ClipboardCheck, ClipboardList, Flag, GraduationCap, LogIn, Sun, UserPlus, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useAssignments, useCurrentUser, useStaffOverview, useStudents } from "../../api/hooks.ts";
import { Badge, Button, buttonClasses, Card, CardHeader, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName, timeAgo } from "../../lib/format.ts";
import { cohortSummary, dayLabel, isWeekZero, percent, timingBadge, timingText, todayLabel, type CohortSummary } from "./progress.ts";
import { useStaffCohorts } from "./staffQueries.ts";

const DUE_NEXT = 4;
const ACTIVITY_PREVIEW = 6;
const linkClass = "inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-kampus-blue hover:underline";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function StaffDashboardPage() {
  const user = useCurrentUser();
  const overview = useStaffOverview();
  const cohorts = useStaffCohorts();
  const students = useStudents();
  const assignments = useAssignments();

  const queries = [cohorts, students, assignments];
  const failed = queries.find((q) => q.isError);
  const ready = cohorts.data && students.data && assignments.data;

  const description = ready ? `${todayLabel()} · ${plural(cohorts.data.length, "cohort")}, ${plural(students.data.length, "student")}` : todayLabel();

  return (
    <>
      <PageHeader
        title={`Hi ${user.firstName}!`}
        description={description}
        actions={
          <Link to="/staff/students?new=1" className={buttonClasses()}>
            <UserPlus aria-hidden className="size-4" />
            Add student
          </Link>
        }
      />

      {failed ? (
        <Card>
          <ErrorState message={errorMessage(failed.error)} onRetry={() => queries.forEach((q) => q.isError && q.refetch())} />
        </Card>
      ) : !ready ? (
        <DashboardSkeleton />
      ) : cohorts.data.length === 0 && students.data.length === 0 ? (
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
        <div className="flex flex-col gap-6">
          <CohortCards cohorts={cohorts.data} students={students.data} assignments={assignments.data} />
          {/* items-start: cada cartão com a sua altura (sem um bloco vazio ao lado da atividade). */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <DueNext assignments={assignments.data} />
            <RecentActivity overview={overview} />
          </div>
        </div>
      )}
    </>
  );
}

function CohortCards({ cohorts, students, assignments }: { cohorts: StaffCohort[]; students: StudentRow[]; assignments: Assignment[] }) {
  if (cohorts.length === 0) {
    return (
      <Card>
        <EmptyState icon={<GraduationCap aria-hidden />} title="No cohorts yet" />
      </Card>
    );
  }
  const now = new Date();
  // A turma que começa primeiro à frente: é a que mais precisa de atenção esta semana.
  const summaries = cohorts.map((c) => cohortSummary(c, students, assignments, now)).sort(bySoonest);
  return (
    <section aria-labelledby="cohorts-title">
      <h2 id="cohorts-title" className="sr-only">
        Cohorts
      </h2>
      <ul className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaries.map((s) => (
          <li key={s.cohort.id}>
            <CohortCard summary={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** As que ainda não começaram primeiro (a mais próxima à frente), depois as já começadas, mais recentes primeiro. */
function bySoonest(a: CohortSummary, b: CohortSummary): number {
  const upcoming = (s: CohortSummary) => s.timing.kind !== "started";
  if (upcoming(a) !== upcoming(b)) return upcoming(a) ? -1 : 1;
  const order = upcoming(a) ? a.cohort.startsOn.localeCompare(b.cohort.startsOn) : b.cohort.startsOn.localeCompare(a.cohort.startsOn);
  return order || a.cohort.name.localeCompare(b.cohort.name);
}

function CohortCard({ summary: s }: { summary: CohortSummary }) {
  const weekZero = isWeekZero(s.timing);
  const name = s.cohort.name;
  const onTimePct = percent(s.onTime, s.dueSoFar);
  return (
    <Card className={cn("flex h-full flex-col overflow-hidden", weekZero && "border-2 border-kampus-blue")}>
      {weekZero && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-kampus-blue/20 bg-kampus-sky-soft px-5 py-2 text-sm text-kampus-navy">
          <Sun aria-hidden className="size-4 shrink-0" />
          <span className="font-semibold">Week zero</span>
          <span aria-hidden>·</span>
          <span>{s.timing.kind === "today" ? "First class today" : `First class ${dayLabel(s.cohort.startsOn)}`}</span>
        </p>
      )}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-kampus-blue-soft text-kampus-blue [&_svg]:size-5">
            <GraduationCap aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold break-words">{name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <Badge tone={s.timing.kind === "started" ? "success" : "sky"}>{timingBadge(s.timing)}</Badge>
              <span>{timingText(s.cohort.startsOn, s.timing)}</span>
            </p>
          </div>
        </div>

        <dl className="flex flex-col gap-4">
          <Metric
            label="Signed in"
            value={pctText(percent(s.signedIn, s.students))}
            progress={[s.signedIn, s.students]}
            barLabel={`${name}: students signed in`}
            caption={`${s.signedIn} of ${plural(s.students, "student")}`}
          />
          <Metric
            label="Tasks on time"
            value={onTimePct === null ? "None due" : `${onTimePct}%`}
            progress={[s.onTime, s.dueSoFar]}
            barLabel={`${name}: cohort tasks done on time`}
            caption={
              s.dueSoFar > 0
                ? `${s.onTime} of ${s.dueSoFar} due so far`
                : s.nextDue
                  ? `First task due ${dayLabel(s.nextDue)}`
                  : s.tasks === 0
                    ? "No cohort tasks yet"
                    : "No due dates yet"
            }
          />
          <Metric
            label="Tour done"
            value={pctText(percent(s.tourDone, s.students))}
            progress={[s.tourDone, s.students]}
            barLabel={`${name}: campus tour done`}
            caption={`${s.tourDone} of ${plural(s.students, "student")}`}
          />
        </dl>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-2">
          {s.needNudge > 0 ? (
            <Link to={`/staff/students?cohort=${s.cohort.id}&status=nudge`} className={cn(linkClass, "text-warning")}>
              <AlertTriangle aria-hidden className="size-4" />
              {s.needNudge} need{s.needNudge === 1 ? "s" : ""} a nudge
              <span className="sr-only"> in {name}</span>
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <p className="flex min-h-11 items-center gap-1 text-sm font-semibold text-success">
              <CircleCheck aria-hidden className="size-4" />
              {s.students === 0 ? "No students yet" : "Everyone's on track"}
            </p>
          )}
          <Link to={`/staff/assignments?cohort=${s.cohort.id}`} className={linkClass}>
            Open cohort<span className="sr-only"> {name}</span>
          </Link>
        </div>
      </div>
    </Card>
  );
}

const pctText = (value: number | null) => (value === null ? "None yet" : `${value}%`);

function Metric({ label, value, progress, barLabel, caption }: { label: string; value: string; progress: [number, number]; barLabel: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <dt className="text-sm text-text">{label}</dt>
        <dd className="font-display text-lg font-semibold text-kampus-navy tabular-nums">{value}</dd>
      </div>
      <ProgressBar value={progress[0]} max={progress[1]} label={barLabel} className="h-2" />
      <p className="text-xs text-muted">{caption}</p>
    </div>
  );
}

// ---------- Due next ----------

/** Em aberto (ainda há alunos por a fazer) e com prazo de hoje em diante; as sem prazo no fim. */
function dueNext(assignments: Assignment[], now: Date = new Date()): Assignment[] {
  const today = localDateKey(now);
  return assignments
    .filter((a) => a.done < a.students && (a.dueDate === null || a.dueDate >= today))
    .sort((a, b) => {
      if (a.dueDate === b.dueDate) return a.title.localeCompare(b.title);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    })
    .slice(0, DUE_NEXT);
}

function DueBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <Badge tone="neutral">No due date</Badge>;
  const status = deadlineStatus(dueDate);
  // Hoje e amanhã sobressaem; o resto mostra só o dia.
  if (status && status.days <= 1) return <Badge tone="warning">{status.label}</Badge>;
  return <Badge tone="neutral">Due {dayLabel(dueDate)}</Badge>;
}

function DueNext({ assignments }: { assignments: Assignment[] }) {
  const list = dueNext(assignments);
  return (
    <Card>
      <CardHeader
        icon={<ClipboardList aria-hidden />}
        title="Due next"
        description="Open tasks with the nearest due date"
        action={
          <Link to="/staff/assignments" className={cn(linkClass, "-mt-2 shrink-0")}>
            All cohort tasks
          </Link>
        }
      />
      <div className="p-5 pt-3">
        {list.length === 0 ? (
          <EmptyState
            icon={<ClipboardList aria-hidden />}
            title={assignments.length === 0 ? "No cohort tasks yet" : "Nothing due next"}
            description={assignments.length === 0 ? "Give a whole cohort a task and track who has done it." : "Every open task is done or past its due date."}
            action={
              <Link to="/staff/assignments?new=1" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                New task
              </Link>
            }
            className="py-6"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {list.map((a) => (
              <li key={a.id} className="@container py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 font-medium break-words text-text">
                    {a.title}
                    <span className="sr-only">, {a.cohort.name}</span>
                  </p>
                  <DueBadge dueDate={a.dueDate} />
                </div>
                <div className="mt-1.5 flex flex-col gap-1.5 @md:flex-row @md:items-center @md:gap-4">
                  <p className="min-w-0 flex-1 text-sm break-words text-muted">
                    {a.cohort.name}
                    {a.createdBy && ` · ${fullName(a.createdBy)}`}
                  </p>
                  <div className="flex items-center gap-3 @md:w-56">
                    <ProgressBar value={a.done} max={a.students} label={`${a.title}, ${a.cohort.name}: students done`} className="h-2 flex-1" />
                    <span className="shrink-0 text-sm font-semibold text-kampus-navy tabular-nums">
                      {a.done}/{a.students} done
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ---------- Recent activity ----------

const activityIcon: Record<ActivityKind, ReactNode> = {
  login: <LogIn aria-hidden />,
  tour_completed: <Flag aria-hidden />,
  student_created: <UserPlus aria-hidden />,
  task_completed: <ClipboardCheck aria-hidden />,
};

// Cor por tipo: os logins ficam discretos, as visitas acabadas e as tarefas feitas sobressaem.
const activityTone: Record<ActivityKind, string> = {
  login: "bg-surface text-muted",
  tour_completed: "bg-success-soft text-success",
  student_created: "bg-kampus-blue-soft text-kampus-blue",
  task_completed: "bg-kampus-blue-soft text-kampus-blue",
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

/** O que aconteceu, com o nome a negrito (o resto do texto normal). */
function ActivityText({ item }: { item: ActivityItem }) {
  const name = <span className="font-semibold">{fullName(item.student)}</span>;
  if (item.kind === "login") return <>{name} logged in</>;
  if (item.kind === "tour_completed") return <>{name} completed the campus tour</>;
  if (item.kind === "task_completed") return <>{name} completed {item.assignment?.title ?? "a cohort task"}</>;
  return <>{name} was added</>;
}

/** "Ana Silva, Rui Costa and 6 more" */
function namesPreview(items: ActivityItem[], max = 3): string {
  const names = items.map((i) => fullName(i.student));
  if (names.length <= max) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

const DAY_TEXT: Record<LoginDay, string> = { today: "today", yesterday: "yesterday", earlier: "recently" };

function RecentActivity({ overview }: { overview: ReturnType<typeof useStaffOverview> }) {
  const [showAll, setShowAll] = useState(false);
  const listId = "recent-activity-list";
  const header = <CardHeader icon={<Activity aria-hidden />} title="Recent activity" description="Logins, finished tasks and tours" />;

  if (overview.isPending)
    return (
      <Card>
        {header}
        <div className="p-5 pt-3">
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </Card>
    );
  if (overview.isError)
    return (
      <Card>
        {header}
        <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} className="py-6" />
      </Card>
    );

  const rows = activityRows(overview.data.recentActivity);
  const visible = showAll ? rows : rows.slice(0, ACTIVITY_PREVIEW);
  return (
    <Card>
      {header}
      <div className="p-5 pt-3">
        {rows.length === 0 ? (
          <EmptyState title="Nothing yet" description="Logins, finished tasks and tours will show up here." className="py-6" />
        ) : (
          <>
            <ul id={listId} className="flex flex-col divide-y divide-line">
              {visible.map((row) => {
                const item = row.type === "event" ? row.item : row.items[0];
                const when = row.type === "logins" ? `Most recent ${timeAgo(item.at)}` : timeAgo(item.at);
                return (
                  <li
                    key={row.type === "event" ? `${item.kind}-${item.student.id}-${item.assignment?.id ?? ""}-${item.at}` : `logins-${row.day}`}
                    className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4", activityTone[item.kind])}>{activityIcon[item.kind]}</span>
                    <div className="min-w-0 flex-1">
                      {row.type === "event" ? (
                        <>
                          <p className="clip-marks text-sm break-words text-text">
                            <ActivityText item={item} />
                          </p>
                          <p className="text-xs text-muted">
                            {item.cohort && `${item.cohort.name} · `}
                            <time dateTime={item.at}>{when}</time>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-text">
                            <span className="font-semibold">{row.items.length} students</span> logged in {DAY_TEXT[row.day]}
                          </p>
                          <p className="clip-marks text-xs break-words text-muted">
                            {namesPreview(row.items)} · <time dateTime={item.at}>{when}</time>
                          </p>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {rows.length > ACTIVITY_PREVIEW && (
              <Button variant="ghost" size="sm" className="mt-3 min-h-11 w-full" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show less activity" : "Show more activity"}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading overview</span>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-96 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-[var(--radius-card)]" />
        <Skeleton className="h-72 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
