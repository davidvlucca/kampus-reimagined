import { deadlineStatus, DEMO_ACCOUNT_MESSAGES, isProtectedDemoEmail, type StaffCohort, type StudentRow } from "@kampus/shared";
import { ChevronDown, ChevronLeft, ChevronRight, Lock, Pencil, Search, SearchX, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useAssignments, useCohorts, useCurrentUser, useDeleteStudent, useStudents } from "../../api/hooks.ts";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, IconButton, Input, PageHeader, ProgressBar, Select, Skeleton, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName, timeAgo } from "../../lib/format.ts";
import { cohortFilter } from "./cohortFilter.ts";
import { ImportStudentsDialog } from "./ImportStudentsDialog.tsx";
import {
  byUrgency,
  groupReminder,
  mailto,
  matchesFilter,
  needsNudge,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_PARAM,
  statusFilter,
  studentProgress,
  studentReminder,
  type Sender,
  type StatusFilter,
  type StudentProgress,
} from "./progress.ts";
import { StudentFormDialog } from "./StudentFormDialog.tsx";
import { MailLink, StatusBadge } from "./StaffParts.tsx";
import { useStaffCohorts } from "./staffQueries.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Linhas por página na tabela; nos cartões, quantos aparecem antes do "Show more". */
const PAGE_SIZE = 10;

interface Row {
  student: StudentRow;
  progress: StudentProgress;
}

export function StudentsPage() {
  const toast = useToast();
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";

  // O texto da pesquisa vive no estado local e vai para o URL com debounce.
  const [search, setSearch] = useState(q);
  // O último `q` que a própria pesquisa escreveu. Um `q` diferente veio de fora (o item
  // "Students" do menu, voltar atrás no browser) e a caixa passa a mostrá-lo; sem isto o
  // debounce voltava a pôr no URL o texto que ainda estava na caixa.
  const writtenQ = useRef(q);
  useEffect(() => {
    if (q === writtenQ.current) return;
    writtenQ.current = q;
    setSearch(q);
  }, [q]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (search.trim() === q) return;
      writtenQ.current = search.trim();
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (search.trim()) next.set("q", search.trim());
          else next.delete("q");
          return next;
        },
        { replace: true },
      );
    }, 250);
    return () => window.clearTimeout(id);
  }, [search, q, setParams]);

  const cohorts = useCohorts();
  const staffCohorts = useStaffCohorts();
  const cohortId = cohortFilter(params.get("cohort"), cohorts.data);
  const status = statusFilter(params.get("status"));
  const students = useStudents({ q, cohortId });
  const assignments = useAssignments(cohortId || undefined);
  const deleteStudent = useDeleteStudent();

  // `?new=1` (vindo do dashboard) abre logo o dialog de criar.
  const [formOpen, setFormOpen] = useState(() => params.get("new") === "1");
  const [formKey, setFormKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importKey, setImportKey] = useState(0);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState<StudentRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };
  const openImport = () => {
    setImportKey((k) => k + 1);
    setImportOpen(true);
  };
  const openEdit = (student: StudentRow) => {
    setEditing(student);
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

  const setParam = (name: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );

  const clearFilters = () => {
    setSearch("");
    setParams(new URLSearchParams(), { replace: true });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteStudent.mutateAsync(deleting.id);
      toast({ title: "Student deleted", description: `${fullName(deleting)} was removed.`, tone: "success" });
    } catch (error) {
      toast({ title: "Couldn't delete student", description: errorMessage(error), tone: "error" });
    }
  };

  const hasFilters = Boolean(q || cohortId);
  const cohortName = cohorts.data?.find((c) => c.id === cohortId)?.name;

  const now = new Date();
  const rows: Row[] | undefined =
    students.data && assignments.data
      ? students.data.map((s) => ({ student: s, progress: studentProgress(s, assignments.data, now) })).sort(byUrgency)
      : undefined;
  const visible = rows?.filter((r) => matchesFilter(r.progress.status, status));
  const pending = students.isPending || assignments.isPending;
  const failed = students.isError ? students : assignments.isError ? assignments : null;

  return (
    <>
      <PageHeader
        title="Students"
        description="Who is ready, who is behind, and who hasn't signed in yet."
        actions={
          <>
            <Button variant="secondary" icon={<Upload aria-hidden className="size-4" />} onClick={openImport}>
              Import CSV
            </Button>
            <Button icon={<UserPlus aria-hidden className="size-4" />} onClick={openCreate}>
              Add student
            </Button>
          </>
        }
      />

      {/* Pela largura do conteúdo (container query): com o texto a 200% a pesquisa ficava com uma letra. */}
      <div className="@container mb-4">
        <div role="search" className="flex flex-col gap-3 @2xl:flex-row @2xl:items-end">
          <div className="relative @2xl:flex-1">
            {/* A meio da caixa (h-11 = 2.75rem): o rótulo está escondido, por isso a caixa é a primeira coisa. */}
            <Search aria-hidden className="pointer-events-none absolute top-[1.375rem] left-3.5 size-4 -translate-y-1/2 text-subtle" />
            <Input
              label="Search students"
              hideLabel
              type="search"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select label="Filter by cohort" hideLabel value={cohortId} onChange={(e) => setParam("cohort", e.target.value)} wrapperClassName="@2xl:w-72">
            <option value="">All cohorts</option>
            {cohorts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {pending ? (
        <StudentsSkeleton />
      ) : failed ? (
        <Card>
          <ErrorState message={errorMessage(failed.error)} onRetry={() => failed.refetch()} />
        </Card>
      ) : !rows || !visible || rows.length === 0 ? (
        <Card>
          {hasFilters ? (
            <EmptyState
              icon={<SearchX aria-hidden />}
              title={`No students match ${describeFilters(q, cohortName)}`}
              description="Try another name or cohort."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Users aria-hidden />}
              title="No students yet"
              description="Add a student and share their temporary password with them."
              action={
                <Button icon={<UserPlus aria-hidden className="size-4" />} onClick={openCreate}>
                  Add student
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <StudentList
          rows={rows}
          visible={visible}
          status={status}
          onStatus={(value) => setParam("status", value === "all" ? "" : value)}
          showCohort={!cohortId}
          cohorts={staffCohorts.data}
          sender={user}
          resetKey={`${q}|${cohortId}|${status}`}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      )}

      <StudentFormDialog key={formKey} open={formOpen} onOpenChange={setFormOpen} student={editing} />
      <ImportStudentsDialog key={`import-${importKey}`} open={importOpen} onOpenChange={setImportOpen} defaultCohortId={cohortId} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${fullName(deleting)}?` : "Delete student?"}
        description={
          deleting
            ? // As tarefas da turma ficam (são da turma); só saem as do próprio aluno.
              `This deletes their account, their own tasks and ${plural(deleting.noteCount, "note")}. This can't be undone.`
            : ""
        }
        confirmLabel="Delete student"
        onConfirm={confirmDelete}
      />
    </>
  );
}

function describeFilters(q: string, cohortName: string | undefined): string {
  if (q && cohortName) return `"${q}" in ${cohortName}`;
  if (q) return `"${q}"`;
  return cohortName ? `the cohort ${cohortName}` : "these filters";
}

interface ListProps {
  /** Todos os alunos da pesquisa e da turma (para as contagens dos filtros). */
  rows: Row[];
  /** Os que passam no filtro de estado, do mais urgente para o menos. */
  visible: Row[];
  status: StatusFilter;
  onStatus: (status: StatusFilter) => void;
  showCohort: boolean;
  cohorts: StaffCohort[] | undefined;
  sender: Sender;
  /** Muda com os filtros: a página volta à primeira. */
  resetKey: string;
  onEdit: (student: StudentRow) => void;
  onDelete: (student: StudentRow) => void;
}

function StudentList(props: ListProps) {
  const { rows, visible, status, onStatus, sender } = props;
  const nudge = rows.filter((r) => needsNudge(r.progress.status));
  // O lembrete a todos de uma vez: em BCC, com as tarefas em atraso de qualquer um deles.
  const overdue = [...new Map(nudge.flatMap((r) => r.progress.overdue).map((a) => [a.id, a])).values()];
  const nudgeHref = mailto(groupReminder(overdue, sender, window.location.origin), { bcc: nudge.map((r) => r.student.email) });
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, rows.filter((r) => r.progress.status === s).length]));

  const chips: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: rows.length },
    ...STATUS_ORDER.map((s) => ({ value: STATUS_PARAM[s], label: STATUS_LABEL[s], count: counts[s] ?? 0 })),
  ];
  // "nudge" (vindo do dashboard) acende os dois filtros que o compõem.
  const pressed = (value: StatusFilter) => value === status || (status === "nudge" && (value === "not-signed-in" || value === "behind"));

  return (
    // No telemóvel não há moldura: os cartões dos alunos ficam diretamente na página, como no
    // resto da app. Pela largura do conteúdo (container query), não do ecrã.
    <div className="@container">
      <div className="@4xl:overflow-hidden @4xl:rounded-[var(--radius-card)] @4xl:border @4xl:border-line @4xl:bg-card @4xl:shadow-card">
      <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between @4xl:border-b @4xl:border-line @4xl:p-4">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={pressed(chip.value)}
              onClick={() => onStatus(chip.value)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition",
                pressed(chip.value) ? "border-kampus-navy bg-kampus-navy text-white" : "border-line-strong bg-card text-kampus-navy hover:bg-kampus-blue-soft",
              )}
            >
              {chip.label}
              <span className={cn("text-xs tabular-nums", pressed(chip.value) ? "text-white/85" : "text-muted")}>{chip.count}</span>
            </button>
          ))}
        </div>
        {nudge.length > 0 && (
          <MailLink href={nudgeHref} variant="primary" icon="send" className="@3xl:shrink-0">
            Remind the {nudge.length} who need{nudge.length === 1 ? "s" : ""} a nudge
          </MailLink>
        )}
      </div>

      <p aria-live="polite" className="pt-4 text-sm text-muted @4xl:sr-only">
        {plural(visible.length, "student")} · most urgent first
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title={status === "nudge" ? "Nobody needs a nudge" : `No students are ${chips.find((c) => c.value === status)?.label.toLowerCase() ?? "here"}`}
          action={
            <Button variant="secondary" onClick={() => onStatus("all")}>
              Show all
            </Button>
          }
        />
      ) : (
        <>
          <StudentsTable {...props} />
          <StudentCards {...props} />
        </>
      )}
      </div>
    </div>
  );
}

/** O resumo de cada estado, por baixo do badge. */
function statusDetail({ student: s, progress: p }: Row): string {
  if (p.status === "not_signed_in") return `Added ${timeAgo(s.createdAt)}`;
  if (p.status === "behind") return p.overdue.length === 1 ? `${p.overdue[0]!.title} overdue` : `${p.overdue.length} tasks overdue`;
  if (p.status === "ready") return p.tasks.length === 1 ? "The cohort task is done" : `All ${p.tasks.length} tasks done`;
  const next = p.open.find((a) => a.dueDate);
  const label = next?.dueDate ? deadlineStatus(next.dueDate)?.label : undefined;
  if (next && label) return `${next.title} ${label.toLowerCase()}`;
  return p.open.length > 0 ? `${plural(p.open.length, "task")} open` : "No cohort tasks yet";
}

function LastSeen({ at, prefix = false }: { at: string | null; prefix?: boolean }) {
  if (!at) return <span className="font-medium text-danger">{prefix ? "Never signed in" : "Never"}</span>;
  return (
    <time dateTime={at}>
      {prefix ? "Seen " : ""}
      {timeAgo(at)}
    </time>
  );
}

/** A conta partilhada da demo não se apaga (a API recusa): diz-se antes de alguém tentar. */
function DemoBadge({ student }: { student: StudentRow }) {
  if (!isProtectedDemoEmail(student.email)) return null;
  return (
    <span title={DEMO_ACCOUNT_MESSAGES.delete}>
      <Badge tone="neutral" icon={<Lock aria-hidden />}>
        Demo account
      </Badge>
    </span>
  );
}

function TaskProgress({ row, suffix = "" }: { row: Row; suffix?: string }) {
  const { student: s, progress: p } = row;
  if (p.tasks.length === 0) return <span className="text-sm text-subtle">No cohort tasks</span>;
  return (
    <div className="flex items-center gap-3">
      <ProgressBar value={p.doneCount} max={p.tasks.length} label={`${fullName(s)}: cohort tasks done`} className="h-2 flex-1" />
      <span className="shrink-0 text-sm font-semibold text-kampus-navy tabular-nums">
        {p.doneCount}/{p.tasks.length}
        {suffix}
      </span>
    </div>
  );
}

function RowActions({ row, cohorts, sender, onEdit, onDelete, wide = false }: { row: Row; wide?: boolean } & Pick<ListProps, "cohorts" | "sender" | "onEdit" | "onDelete">) {
  const { student } = row;
  const name = fullName(student);
  const isDemo = isProtectedDemoEmail(student.email);
  const cohort = cohorts?.find((c) => c.id === student.cohort?.id);
  const href = mailto(studentReminder(student, row.progress, cohort, sender, window.location.origin), { to: student.email });
  return (
    <div className="flex items-center justify-end gap-2">
      <MailLink href={href} size="sm" className={cn(wide && "flex-1")}>
        Remind<span className="sr-only"> {name}</span>
      </MailLink>
      <IconButton label={`Edit ${name}`} variant="secondary" icon={<Pencil aria-hidden />} onClick={() => onEdit(student)} />
      <IconButton
        label={isDemo ? `Delete ${name} (not available on the shared demo account)` : `Delete ${name}`}
        title={isDemo ? DEMO_ACCOUNT_MESSAGES.delete : undefined}
        variant="secondary"
        icon={<Trash2 aria-hidden />}
        disabled={isDemo}
        className="text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-card"
        onClick={() => onDelete(student)}
      />
    </div>
  );
}

/** A página volta à primeira quando os filtros mudam (`resetKey`). */
function useResettable<T>(initial: T, resetKey: string): [T, (value: T) => void] {
  const [state, setState] = useState({ key: resetKey, value: initial });
  return [state.key === resetKey ? state.value : initial, (value: T) => setState({ key: resetKey, value })];
}

/** Conteúdo com 56rem ou mais (desktop): tabela semântica, dez linhas por página. */
function StudentsTable(props: ListProps) {
  const { visible, showCohort, sender, resetKey } = props;
  const [page, setPage] = useResettable(0, resetKey);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const th = "px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted uppercase";
  // table-fixed com larguras por coluna: numa tabela automática o nome e o email compridos
  // (o `truncate` não segura sem largura) alargavam a tabela para fora do cartão e da página.
  return (
    <div className="hidden @4xl:block">
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Students, most urgent first, with their status, cohort tasks and when they were last seen</caption>
        <thead className="border-b border-line bg-surface">
          <tr>
            <th scope="col" className={th}>
              Student
            </th>
            <th scope="col" className={cn(th, "w-60")}>
              Status
            </th>
            <th scope="col" className={cn(th, "w-40")}>
              Cohort tasks
            </th>
            <th scope="col" className={cn(th, "w-32")}>
              Last seen
            </th>
            <th scope="col" className={cn(th, "w-60")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {slice.map((row) => {
            const s = row.student;
            return (
              <tr key={s.id} className="transition hover:bg-surface/70">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold text-text" title={fullName(s)}>
                          {fullName(s)}
                        </span>
                        <DemoBadge student={s} />
                      </p>
                      <p className="truncate text-muted" title={s.email}>
                        {s.email}
                      </p>
                      {showCohort && <p className="truncate text-xs text-subtle">{s.cohort?.name ?? "No cohort"}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.progress.status} />
                  <p className="mt-1 text-xs break-words text-muted">{statusDetail(row)}</p>
                </td>
                <td className="px-4 py-3">
                  <TaskProgress row={row} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  <LastSeen at={s.lastLoginAt} />
                </td>
                <td className="px-4 py-2">
                  <RowActions row={row} {...props} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
        <p>
          Showing {current * PAGE_SIZE + 1} to {current * PAGE_SIZE + slice.length} of {visible.length} · most urgent first · reminders go out from {fullName(sender)}
        </p>
        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center gap-2">
            <IconButton label="Previous page" variant="secondary" icon={<ChevronLeft aria-hidden />} disabled={current === 0} onClick={() => setPage(current - 1)} />
            <span className="font-semibold text-kampus-navy" aria-live="polite">
              Page {current + 1} of {pages}
            </span>
            <IconButton label="Next page" variant="secondary" icon={<ChevronRight aria-hidden />} disabled={current >= pages - 1} onClick={() => setPage(current + 1)} />
          </nav>
        )}
      </div>
    </div>
  );
}

/** Telemóvel e tablet: cartões com a mesma informação, os mais urgentes primeiro. */
function StudentCards(props: ListProps) {
  const { visible, showCohort, resetKey } = props;
  const [expanded, setExpanded] = useResettable(false, resetKey);
  const shown = expanded ? visible : visible.slice(0, PAGE_SIZE);
  const listId = "student-cards";
  return (
    <div className="pt-3 @4xl:hidden">
      <ul id={listId} className="flex flex-col gap-3">
        {shown.map((row) => {
          const s = row.student;
          return (
            <li key={s.id} className="rounded-2xl border border-line bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <Avatar firstName={s.firstName} lastName={s.lastName} />
                <div className="min-w-[min(100%,8rem)] flex-1">
                  <h2 className="text-base font-semibold break-words">{fullName(s)}</h2>
                  {/* Inteiro (parte só se não couber): cortado com reticências não se lia. */}
                  <p className="text-sm wrap-anywhere text-muted">{s.email}</p>
                  {showCohort && <p className="text-xs text-subtle">{s.cohort?.name ?? "No cohort"}</p>}
                </div>
                <StatusBadge status={row.progress.status} />
              </div>
              <div className="mt-2">
                <DemoBadge student={s} />
              </div>
              <div className="mt-3">
                <TaskProgress row={row} suffix=" tasks" />
              </div>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-muted">
                <span className="min-w-0 break-words">{statusDetail(row)}</span>
                <LastSeen at={s.lastLoginAt} prefix />
              </div>
              <div className="mt-3">
                <RowActions row={row} wide {...props} />
              </div>
            </li>
          );
        })}
      </ul>
      {visible.length > PAGE_SIZE && (
        <Button
          variant="secondary"
          className="mt-3 w-full"
          aria-expanded={expanded}
          aria-controls={listId}
          icon={<ChevronDown aria-hidden className={cn("size-4 transition", expanded && "rotate-180")} />}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show fewer" : `Show ${visible.length - PAGE_SIZE} more`}
        </Button>
      )}
    </div>
  );
}

function StudentsSkeleton() {
  return (
    <div role="status" className="@container">
      <span className="sr-only">Loading students</span>
      <Card className="hidden flex-col divide-y divide-line @4xl:flex">
        <Skeleton className="m-4 h-9 w-1/2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
      <div className="flex flex-col gap-3 @4xl:hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}

