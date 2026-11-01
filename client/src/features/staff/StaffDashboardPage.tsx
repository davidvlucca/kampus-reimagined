import type { ActivityItem, ActivityKind, Assignment, StaffOverview } from "@kampus/shared";
import { ClipboardList, GraduationCap, LogIn, Map as MapIcon, MapPinned, Sparkles, UserPlus, Users } from "lucide-react";
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
import { fullName, timeAgo } from "../../lib/format.ts";
import { AssignmentDeadline, AssignmentProgress } from "./AssignmentProgress.tsx";

const PENDING_PREVIEW = 6;
const ASSIGNMENTS_PREVIEW = 3;
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold">{cohort.name}</h3>
                      <Badge tone="blue">{students === 1 ? "1 student" : `${students} students`}</Badge>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PendingTour pending={data.pendingTour} />
        <RecentActivity items={data.recentActivity} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-kampus-blue-soft text-kampus-blue [&_svg]:size-5">{icon}</span>
      <div className="flex min-w-0 flex-col-reverse">
        <p className="text-sm text-muted">{label}</p>
        <p className="font-display text-2xl font-semibold text-kampus-navy">{value}</p>
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
            <ul id={listId} className="flex flex-col divide-y divide-line">
              {visible.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium text-text">{fullName(s)}</span>
                  {s.cohort && <Badge tone="sky">{s.cohort.name}</Badge>}
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

/** Em aberto = ainda há alunos por a fazer. Os prazos mais próximos primeiro; sem prazo no fim. */
function nextOpen(assignments: Assignment[]): Assignment[] {
  return assignments
    .filter((a) => a.done < a.students)
    .sort((a, b) => {
      if (a.dueDate === b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    })
    .slice(0, ASSIGNMENTS_PREVIEW);
}

function OpenAssignments() {
  const assignments = useAssignments();
  const open = assignments.data ? nextOpen(assignments.data) : [];

  return (
    <Card>
      <CardHeader
        icon={<ClipboardList aria-hidden />}
        title="Cohort tasks"
        description="Open tasks with the nearest due date."
        action={
          <Link to="/staff/assignments" className={linkClass + " mt-2 shrink-0"}>
            See all
          </Link>
        }
      />
      <CardBody>
        {assignments.isPending ? (
          <SkeletonList rows={3} label="Loading cohort tasks" />
        ) : assignments.isError ? (
          <ErrorState message={errorMessage(assignments.error)} onRetry={() => assignments.refetch()} className="py-6" />
        ) : open.length === 0 ? (
          <EmptyState
            icon={<ClipboardList aria-hidden />}
            title={assignments.data.length === 0 ? "No cohort tasks yet" : "Every cohort task is done"}
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
            {open.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words text-text">{a.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="sky">{a.cohort.name}</Badge>
                    <AssignmentDeadline assignment={a} />
                  </div>
                </div>
                <AssignmentProgress assignment={a} className="sm:w-56 sm:shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

const activityIcon: Record<ActivityKind, ReactNode> = {
  login: <LogIn aria-hidden />,
  tour_completed: <MapIcon aria-hidden />,
  student_created: <UserPlus aria-hidden />,
};

function activityText(item: ActivityItem): string {
  const name = fullName(item.student);
  if (item.kind === "login") return `${name} logged in`;
  if (item.kind === "tour_completed") return `${name} completed the campus tour`;
  return `${name} was added`;
}

function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader icon={<Sparkles aria-hidden />} title="Recent activity" />
      <CardBody>
        {items.length === 0 ? (
          <EmptyState title="Nothing yet" description="Logins and finished tours will show up here." className="py-6" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {items.map((item) => (
              <li key={`${item.kind}-${item.student.id}-${item.at}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-kampus-blue [&_svg]:size-4">{activityIcon[item.kind]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text">{activityText(item)}</p>
                  <time dateTime={item.at} className="text-xs text-subtle">
                    {timeAgo(item.at)}
                  </time>
                </div>
              </li>
            ))}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
