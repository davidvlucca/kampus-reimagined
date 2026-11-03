import { DEMO_ACCOUNT_MESSAGES, isProtectedDemoEmail, type StudentRow } from "@kampus/shared";
import { Lock, Pencil, Search, SearchX, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useCohorts, useDeleteStudent, useStudents } from "../../api/hooks.ts";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  useToast,
} from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName, timeAgo } from "../../lib/format.ts";
import { cohortFilter } from "./cohortFilter.ts";
import { StudentFormDialog } from "./StudentFormDialog.tsx";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
// O Badge não quebra linha; com nomes de turma compridos e texto a 200% saía do cartão.
const wrapBadge = "max-w-full rounded-xl whitespace-normal break-words";

export function StudentsPage() {
  const toast = useToast();
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
  const cohortId = cohortFilter(params.get("cohort"), cohorts.data);
  const students = useStudents({ q, cohortId });
  const deleteStudent = useDeleteStudent();

  // `?new=1` (vindo do dashboard) abre logo o dialog de criar.
  const [formOpen, setFormOpen] = useState(() => params.get("new") === "1");
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState<StudentRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
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
  const list = students.data;

  return (
    <>
      <PageHeader
        title="Students"
        description="Add students, keep their details up to date and see how they're doing."
        actions={
          <Button icon={<UserPlus aria-hidden className="size-4" />} onClick={openCreate}>
            Add student
          </Button>
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
          <Select label="Filter by cohort" hideLabel value={cohortId} onChange={(e) => setCohort(e.target.value)} wrapperClassName="@2xl:w-60">
            <option value="">All cohorts</option>
            {cohorts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p aria-live="polite" className="mb-3 text-sm text-muted">
        {list ? plural(list.length, "student") : ""}
      </p>

      {students.isPending ? (
        <StudentsSkeleton />
      ) : students.isError ? (
        <Card>
          <ErrorState message={errorMessage(students.error)} onRetry={() => students.refetch()} />
        </Card>
      ) : students.data.length === 0 ? (
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
        // Tabela ou cartões pela largura do conteúdo em rem (container query), não do ecrã:
        // com o texto a 200% num portátil a tabela já não cabe e passa a cartões.
        <div className="@container">
          <StudentsTable students={students.data} onEdit={openEdit} onDelete={setDeleting} />
          <StudentCards students={students.data} onEdit={openEdit} onDelete={setDeleting} />
        </div>
      )}

      <StudentFormDialog key={formKey} open={formOpen} onOpenChange={setFormOpen} student={editing} />

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
  students: StudentRow[];
  onEdit: (student: StudentRow) => void;
  onDelete: (student: StudentRow) => void;
}

function TourBadge({ done }: { done: boolean }) {
  return done ? <Badge tone="success">Done</Badge> : <Badge tone="warning">Pending</Badge>;
}

function LastLogin({ at }: { at: string | null }) {
  return at ? <time dateTime={at}>{timeAgo(at)}</time> : <span>Never</span>;
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

function TaskProgress({ student: s }: { student: StudentRow }) {
  if (s.taskCount === 0) return <span className="text-subtle">No tasks</span>;
  return (
    <div className="flex flex-col gap-1">
      <ProgressBar value={s.doneTaskCount} max={s.taskCount} label={`${fullName(s)}: tasks done`} className="h-1.5 max-w-24" />
      <span className="text-xs text-muted tabular-nums">
        {s.doneTaskCount}/{s.taskCount} done
      </span>
    </div>
  );
}

function RowActions({ student, onEdit, onDelete }: { student: StudentRow; onEdit: ListProps["onEdit"]; onDelete: ListProps["onDelete"] }) {
  const name = fullName(student);
  const isDemo = isProtectedDemoEmail(student.email);
  return (
    <div className="flex justify-end gap-1">
      <IconButton label={`Edit ${name}`} icon={<Pencil aria-hidden />} onClick={() => onEdit(student)} />
      <IconButton
        label={isDemo ? `Delete ${name} (not available on the shared demo account)` : `Delete ${name}`}
        title={isDemo ? DEMO_ACCOUNT_MESSAGES.delete : undefined}
        variant="danger"
        icon={<Trash2 aria-hidden />}
        disabled={isDemo}
        className="disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted"
        onClick={() => onDelete(student)}
      />
    </div>
  );
}

/** Conteúdo com 56rem ou mais (desktop): tabela semântica. */
function StudentsTable({ students, onEdit, onDelete }: ListProps) {
  const th = "px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted uppercase";
  // table-fixed com larguras por coluna: numa tabela automática o nome e o email compridos
  // (o `truncate` não segura sem largura) alargavam a tabela para fora do cartão e da página.
  // A coluna do aluno fica com o resto e corta com reticências.
  return (
    <Card className="hidden overflow-x-auto @4xl:block">
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Students, with their cohort, tasks, tour and last login</caption>
        <thead className="border-b border-line bg-surface">
          <tr>
            <th scope="col" className={th}>
              Student
            </th>
            <th scope="col" className={cn(th, "w-56")}>
              Cohort
            </th>
            <th scope="col" className={cn(th, "w-28")}>
              Tasks
            </th>
            <th scope="col" className={cn(th, "w-28")}>
              Tour
            </th>
            <th scope="col" className={cn(th, "w-32")}>
              Last login
            </th>
            <th scope="col" className={cn(th, "w-28")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {students.map((s) => (
            <tr key={s.id} className="transition hover:bg-surface/70">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-text" title={fullName(s)}>
                        {fullName(s)}
                      </span>
                      <DemoBadge student={s} />
                    </p>
                    <p className="truncate text-muted" title={s.email}>
                      {s.email}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                {s.cohort ? (
                  <Badge tone="sky" className={wrapBadge}>
                    {s.cohort.name}
                  </Badge>
                ) : (
                  <span className="text-subtle">No cohort</span>
                )}
              </td>
              <td className="px-4 py-3 text-text">
                <TaskProgress student={s} />
              </td>
              <td className="px-4 py-3">
                <TourBadge done={Boolean(s.tourCompletedAt)} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">
                <LastLogin at={s.lastLoginAt} />
              </td>
              <td className="px-4 py-2">
                <RowActions student={s} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Telemóvel e tablet: cartões com a mesma informação. */
function StudentCards({ students, onEdit, onDelete }: ListProps) {
  return (
    <ul className="flex flex-col gap-3 @4xl:hidden">
      {students.map((s) => (
        <li key={s.id}>
          <Card className="p-4">
            {/* flex-wrap: sem espaço (texto a 200%), os botões passam para a linha de baixo. */}
            <div className="flex flex-wrap items-center gap-3">
              <Avatar firstName={s.firstName} lastName={s.lastName} />
              <h2 className="min-w-[min(100%,8rem)] flex-1 text-base font-semibold break-words">{fullName(s)}</h2>
              <RowActions student={s} onEdit={onEdit} onDelete={onDelete} />
            </div>
            {/* Por baixo, com a largura toda e inteiro (parte só se não couber): cortado com reticências não se lia. */}
            <p className="mt-0.5 pl-13 text-sm wrap-anywhere text-muted">{s.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.cohort && (
                <Badge tone="sky" className={wrapBadge}>
                  {s.cohort.name}
                </Badge>
              )}
              <TourBadge done={Boolean(s.tourCompletedAt)} />
              <DemoBadge student={s} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-subtle">Tasks</dt>
                <dd className="mt-1 text-text">
                  <TaskProgress student={s} />
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Last login</dt>
                <dd className="text-text">
                  <LastLogin at={s.lastLoginAt} />
                </dd>
              </div>
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function StudentsSkeleton() {
  return (
    <div role="status" className="@container">
      <span className="sr-only">Loading students</span>
      <Card className="hidden flex-col divide-y divide-line @4xl:flex">
        <Skeleton className="m-4 h-4 w-1/3" />
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
          <Skeleton key={i} className="h-36 rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}
