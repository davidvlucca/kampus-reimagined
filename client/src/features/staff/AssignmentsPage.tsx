import { deadlineStatus, localDateKey, type Assignment, type StaffCohort, type StudentRow } from "@kampus/shared";
import { ChevronDown, ClipboardList, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useRef, useState, type Ref } from "react";
import { useSearchParams } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useAssignments, useCurrentUser, useDeleteAssignment, useStudents } from "../../api/hooks.ts";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, IconButton, PageHeader, ProgressBar, Select, Skeleton, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName, timeAgo } from "../../lib/format.ts";
import { AssignmentFormDialog } from "./AssignmentFormDialog.tsx";
import { cohortFilter } from "./cohortFilter.ts";
import { cohortTiming, dayLabel, mailto, relativeDay, taskReminder, type Sender } from "./progress.ts";
import { MailLink } from "./StaffParts.tsx";
import { useStaffCohorts } from "./staffQueries.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Sem `?cohort=` no URL: a turma que começa a seguir (a que mais precisa das tarefas
 * pré-início); se já começaram todas, a que começou mais recentemente.
 */
function defaultCohort(cohorts: StaffCohort[], now: Date = new Date()): StaffCohort | undefined {
  const today = localDateKey(now);
  const upcoming = cohorts.filter((c) => c.startsOn >= today).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return upcoming[0] ?? [...cohorts].sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
}

/** Tarefas que o staff dá a uma turma inteira, numa linha do tempo a contar do primeiro dia. */
export function AssignmentsPage() {
  const toast = useToast();
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const cohorts = useStaffCohorts();
  const fromUrl = cohortFilter(params.get("cohort"), cohorts.data);
  const cohort = cohorts.data?.find((c) => c.id === fromUrl) ?? (cohorts.data ? defaultCohort(cohorts.data) : undefined);
  const cohortId = cohort?.id ?? "";
  // Todas as turmas de uma vez (a mesma cache do dashboard): mudar de turma é imediato e
  // não depende de as turmas já terem carregado.
  const assignments = useAssignments();
  const students = useStudents();
  const deleteAssignment = useDeleteAssignment();

  // `?new=1` (vindo do dashboard) abre logo o dialog de criar.
  const [formOpen, setFormOpen] = useState(() => params.get("new") === "1");
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState<Assignment | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };
  const openEdit = (assignment: Assignment) => {
    setEditing(assignment);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  // Depois de abrir, tira o `new` do URL.
  useEffect(() => {
    if (params.get("new") !== "1") return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("new");
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  const setCohort = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("cohort", value);
        else next.delete("cohort");
        return next;
      },
      { replace: true },
    );

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteAssignment.mutateAsync(deleting.id);
      toast({ title: "Task deleted", description: `"${deleting.title}" was removed from ${deleting.cohort.name}.`, tone: "success" });
    } catch (error) {
      toast({ title: "Couldn't delete the task", description: errorMessage(error), tone: "error" });
    }
  };

  const list = assignments.data?.filter((a) => a.cohort.id === cohortId);
  const members = students.data?.filter((s) => s.cohort?.id === cohortId);
  const failed = cohorts.isError ? cohorts : assignments.isError ? assignments : students.isError ? students : null;

  return (
    <>
      <PageHeader
        title="Cohort tasks"
        description={cohort && list ? headerText(cohort, list) : "Give a whole cohort a task and see who has done it."}
        actions={
          <>
            {cohorts.data && cohorts.data.length > 0 && (
              <Select label="Cohort" hideLabel value={cohortId} onChange={(e) => setCohort(e.target.value)} wrapperClassName="w-full sm:w-64">
                {cohorts.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            <Button icon={<Plus aria-hidden className="size-4" />} onClick={openCreate}>
              New task
            </Button>
          </>
        }
      />

      {failed ? (
        <Card>
          <ErrorState message={errorMessage(failed.error)} onRetry={() => failed.refetch()} />
        </Card>
      ) : cohorts.data && cohorts.data.length === 0 ? (
        <Card>
          <EmptyState icon={<Users aria-hidden />} title="No cohorts yet" description="Cohort tasks belong to a cohort. Once there's one, you can give it tasks here." />
        </Card>
      ) : !cohort || !list || !members ? (
        <AssignmentsSkeleton />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList aria-hidden />}
            title={`No tasks for ${cohort.name} yet`}
            description="Add a task, like handing in a form, and every student in the cohort gets it."
            action={
              <Button icon={<Plus aria-hidden className="size-4" />} onClick={openCreate}>
                New task
              </Button>
            }
          />
        </Card>
      ) : (
        <Timeline key={cohort.id} cohort={cohort} tasks={list} students={members} sender={user} onEdit={openEdit} onDelete={setDeleting} />
      )}

      <AssignmentFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        assignment={editing}
        defaultCohortId={cohortId}
        onCreated={(created) => created.cohort.id !== cohortId && setCohort(created.cohort.id)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this task?"
        description={
          deleting ? `"${deleting.title}" disappears from every student's list in ${deleting.cohort.name}, including who has done it. This can't be undone.` : ""
        }
        confirmLabel="Delete task"
        onConfirm={confirmDelete}
      />
    </>
  );
}

/** "Starts Mon 9 Nov, in 4 days · 49 of 72 due tasks done". */
function headerText(cohort: StaffCohort, tasks: Assignment[]): string {
  const timing = cohortTiming(cohort.startsOn);
  const when =
    timing.kind === "today"
      ? "Starts today"
      : timing.kind === "upcoming"
        ? `Starts ${dayLabel(cohort.startsOn)}, in ${plural(timing.days, "day")}`
        : `Started ${dayLabel(cohort.startsOn)}, week ${timing.week}`;
  const today = localDateKey(new Date());
  const due = tasks.filter((a) => a.dueDate !== null && a.dueDate < today);
  if (due.length === 0) return `${when} · nothing due yet`;
  const done = due.reduce((sum, a) => sum + a.done, 0);
  const total = due.reduce((sum, a) => sum + a.students, 0);
  return `${when} · ${done} of ${total} due tasks done`;
}

interface TimelineProps {
  cohort: StaffCohort;
  /** Pela ordem da API: prazo mais próximo primeiro, sem prazo no fim. */
  tasks: Assignment[];
  students: StudentRow[];
  sender: Sender;
  onEdit: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
}

function Timeline({ cohort, tasks, students, sender, onEdit, onDelete }: TimelineProps) {
  const today = localDateKey(new Date());
  // Começa na primeira tarefa que ainda tem alunos por a fazer.
  const [selectedId, setSelectedId] = useState(() => (tasks.find((a) => a.done < a.students) ?? tasks[0])?.id ?? "");
  const selected = tasks.find((a) => a.id === selectedId) ?? tasks[0];
  const panelHeading = useRef<HTMLHeadingElement>(null);

  const select = (id: string) => {
    setSelectedId(id);
    // No telemóvel o painel fica por baixo da lista: o foco (e o ecrã) vai até ele.
    requestAnimationFrame(() => panelHeading.current?.focus());
  };

  // O marcador "Today" entra antes da primeira tarefa com prazo de hoje em diante (as sem prazo ficam depois dele).
  const todayIndex = tasks.findIndex((a) => a.dueDate === null || a.dueDate >= today);
  const marker = todayIndex === -1 ? tasks.length : todayIndex;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <ol aria-label={`${cohort.name} timeline`} className="relative flex flex-col gap-4">
        {/* A linha vertical da régua, por trás dos rótulos. */}
        <span aria-hidden className="absolute top-4 bottom-4 left-8 w-0.5 -translate-x-1/2 bg-line" />
        {tasks.map((a, i) => (
          <TimelineItem
            key={a.id}
            task={a}
            cohort={cohort}
            students={students}
            sender={sender}
            today={today}
            selected={selected?.id === a.id}
            onSelect={() => select(a.id)}
            onEdit={onEdit}
            onDelete={onDelete}
            todayBefore={i === marker}
          />
        ))}
        {marker === tasks.length && <TodayMarker today={today} cohort={cohort} />}
      </ol>
      {selected && <WhoPanel ref={panelHeading} task={selected} cohort={cohort} students={students} sender={sender} />}
    </div>
  );
}

function TodayMarker({ today, cohort }: { today: string; cohort: StaffCohort }) {
  return (
    <li className="flex items-center gap-3">
      <span className="relative z-10 w-16 shrink-0 text-center">
        <span className="inline-block rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">Today</span>
      </span>
      <span aria-hidden className="h-0 flex-1 border-t-2 border-dashed border-danger/50" />
      <span className="shrink-0 text-xs font-semibold text-danger">
        {dayLabel(today)} · {relativeDay(today, cohort.startsOn)}
      </span>
    </li>
  );
}

function StatusBadgeFor({ task, today }: { task: Assignment; today: string }) {
  if (task.students > 0 && task.done >= task.students) return <Badge tone="success">All done</Badge>;
  if (!task.dueDate) return null;
  if (task.dueDate < today) return <Badge tone="danger">Overdue</Badge>;
  const status = deadlineStatus(task.dueDate);
  if (status && status.days <= 1) return <Badge tone="warning">{status.label}</Badge>;
  return null;
}

/** Quem ainda não fez a tarefa (entre os alunos de hoje na turma). */
const missingFor = (task: Assignment, students: StudentRow[]) => students.filter((s) => !s.completions.some((c) => c.assignmentId === task.id));

function TimelineItem({
  task: a,
  cohort,
  students,
  sender,
  today,
  selected,
  onSelect,
  onEdit,
  onDelete,
  todayBefore,
}: {
  task: Assignment;
  cohort: StaffCohort;
  students: StudentRow[];
  sender: Sender;
  today: string;
  selected: boolean;
  onSelect: () => void;
  onEdit: (a: Assignment) => void;
  onDelete: (a: Assignment) => void;
  todayBefore: boolean;
}) {
  const missing = missingFor(a, students);
  const named = `"${a.title}"`;
  const href = mailto(taskReminder(a, sender, window.location.origin), { bcc: missing.map((s) => s.email) });
  const label = a.dueDate ? relativeDay(a.dueDate, cohort.startsOn) : "No date";
  const dayOne = label === "Day 1";
  return (
    <>
      {todayBefore && <TodayMarker today={today} cohort={cohort} />}
      <li className="flex items-start gap-3">
        <span className="relative z-10 w-16 shrink-0 pt-4 text-center">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
              dayOne ? "bg-kampus-navy text-white" : "bg-kampus-blue-soft text-kampus-navy",
            )}
          >
            {label}
          </span>
        </span>
        <article
          aria-labelledby={`task-${a.id}-title`}
          className={cn("@container min-w-0 flex-1 rounded-2xl border bg-card p-4 shadow-card", selected ? "border-2 border-kampus-blue" : "border-line")}
        >
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h2 id={`task-${a.id}-title`} className="min-w-[min(100%,10rem)] flex-1 text-base font-semibold break-words">
              {a.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadgeFor task={a} today={today} />
              {a.dueDate && <span className="text-sm text-muted">Due {dayLabel(a.dueDate)}</span>}
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-2 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-4">
            <p className="flex min-w-0 items-center gap-2 text-sm text-muted">
              {a.createdBy ? (
                <>
                  <Avatar firstName={a.createdBy.firstName} lastName={a.createdBy.lastName} size="sm" className="size-6 text-[0.6rem]" />
                  <span className="min-w-0 break-words">
                    {fullName(a.createdBy)}
                    {a.createdBy.title && ` · ${a.createdBy.title}`}
                  </span>
                </>
              ) : (
                "From staff"
              )}
            </p>
            <div className="flex items-center gap-3 @lg:w-60">
              <ProgressBar value={a.done} max={a.students} label={`${a.title}: students done`} className="h-2 flex-1" />
              <span className="shrink-0 text-sm font-semibold text-kampus-navy tabular-nums">{a.students === 0 ? "No students" : `${a.done}/${a.students}`}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {missing.length > 0 && (
              <MailLink href={href} size="sm" icon="send" variant={selected ? "primary" : "secondary"}>
                Email the {missing.length} who {missing.length === 1 ? "hasn't" : "haven't"} done it
                <span className="sr-only">: {named}</span>
              </MailLink>
            )}
            {a.students > 0 && (
              <Button variant="ghost" size="sm" className="min-h-11" aria-pressed={selected} onClick={onSelect}>
                See who
                <span className="sr-only"> has done {named}</span>
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <IconButton label={`Edit ${named}`} variant="secondary" icon={<Pencil aria-hidden />} onClick={() => onEdit(a)} />
              <IconButton label={`Delete ${named}`} variant="secondary" className="text-danger hover:bg-danger-soft" icon={<Trash2 aria-hidden />} onClick={() => onDelete(a)} />
            </div>
          </div>
        </article>
      </li>
    </>
  );
}

function WhoPanel({
  ref,
  task,
  cohort,
  students,
  sender,
}: {
  ref: Ref<HTMLHeadingElement>;
  task: Assignment;
  cohort: StaffCohort;
  students: StudentRow[];
  sender: Sender;
}) {
  const [showDone, setShowDone] = useState(false);
  const missing = missingFor(task, students);
  const done = students
    .flatMap((s) => {
      const c = s.completions.find((x) => x.assignmentId === task.id);
      return c ? [{ student: s, at: c.completedAt }] : [];
    })
    .sort((a, b) => b.at.localeCompare(a.at));
  const mail = taskReminder(task, sender, window.location.origin);
  const href = mailto(mail, { bcc: missing.map((s) => s.email) });
  const doneId = `who-done-${task.id}`;

  return (
    <Card className="p-5 lg:sticky lg:top-6">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        {task.dueDate ? `${relativeDay(task.dueDate, cohort.startsOn)} · Due ${dayLabel(task.dueDate)}` : "No due date"}
      </p>
      <h2 ref={ref} tabIndex={-1} className="mt-1 text-lg font-semibold break-words outline-none">
        {missing.length === 0 ? `Everyone has done "${task.title}"` : `${missing.length} ${missing.length === 1 ? "hasn't" : "haven't"} done "${task.title}"`}
      </h2>

      {missing.length > 0 && (
        <ul aria-label={`Students who haven't done "${task.title}"`} className="mt-3 flex flex-col divide-y divide-line">
          {missing.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{fullName(s)}</span>
              {s.lastLoginAt ? <span className="text-xs text-muted">Not done yet</span> : <Badge tone="danger">Not signed in</Badge>}
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-2 min-h-11"
            aria-expanded={showDone}
            aria-controls={doneId}
            icon={<ChevronDown aria-hidden className={cn("size-4 transition", showDone && "rotate-180")} />}
            onClick={() => setShowDone((v) => !v)}
          >
            {plural(done.length, "student")} did it
          </Button>
          <ul id={doneId} hidden={!showDone} aria-label={`Students who have done "${task.title}"`} className="flex flex-col divide-y divide-line">
            {done.map(({ student: s, at }) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{fullName(s)}</span>
                <Badge tone="success">Done</Badge>
                <time dateTime={at} className="sr-only">
                  {timeAgo(at)}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}

      {missing.length > 0 && (
        <>
          <div className="mt-4 rounded-xl border border-line bg-surface p-3 text-sm">
            <p className="font-semibold text-kampus-navy">Reminder preview</p>
            <p className="mt-1 font-medium text-text">{mail.subject}</p>
            <p className="mt-1 whitespace-pre-line text-muted">{mail.body}</p>
            <p className="mt-2 text-xs text-subtle">Opens in your email app, from {fullName(sender)}. Students are in BCC, so they don't see each other's addresses.</p>
          </div>
          <MailLink href={href} variant="primary" icon="send" className="mt-4 w-full">
            Email all {missing.length}
          </MailLink>
        </>
      )}
    </Card>
  );
}

function AssignmentsSkeleton() {
  return (
    <div role="status" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <span className="sr-only">Loading cohort tasks</span>
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-[var(--radius-card)]" />
    </div>
  );
}
