import type { StudentRow } from "@kampus/shared";
import { Pencil, SearchX, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
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
  Select,
  Skeleton,
  useToast,
} from "../../components/ui/index.ts";
import { fullName, timeAgo } from "../../lib/format.ts";
import { StudentFormDialog } from "./StudentFormDialog.tsx";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function StudentsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cohortId = params.get("cohort") ?? "";

  // O texto da pesquisa vive no estado local e vai para o URL com debounce.
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (search.trim() === q) return;
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

      <div role="search" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label="Search students"
          hideLabel
          type="search"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="sm:flex-1"
        />
        <Select label="Filter by cohort" hideLabel value={cohortId} onChange={(e) => setCohort(e.target.value)} wrapperClassName="sm:w-60">
          <option value="">All cohorts</option>
          {cohorts.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
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
        <>
          <StudentsTable students={students.data} onEdit={openEdit} onDelete={setDeleting} />
          <StudentCards students={students.data} onEdit={openEdit} onDelete={setDeleting} />
        </>
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

function RowActions({ student, onEdit, onDelete }: { student: StudentRow; onEdit: ListProps["onEdit"]; onDelete: ListProps["onDelete"] }) {
  const name = fullName(student);
  return (
    <div className="flex justify-end gap-1">
      <IconButton label={`Edit ${name}`} icon={<Pencil aria-hidden />} onClick={() => onEdit(student)} />
      <IconButton label={`Delete ${name}`} variant="danger" icon={<Trash2 aria-hidden />} onClick={() => onDelete(student)} />
    </div>
  );
}

/** Desktop (≥ lg): tabela semântica. */
function StudentsTable({ students, onEdit, onDelete }: ListProps) {
  const th = "px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted uppercase";
  return (
    <Card className="hidden overflow-x-auto xl:block">
      <table className="w-full text-sm">
        <caption className="sr-only">Students, with their cohort, tasks, tour and last login</caption>
        <thead className="border-b border-line bg-surface">
          <tr>
            <th scope="col" className={th}>
              Student
            </th>
            <th scope="col" className={th}>
              Cohort
            </th>
            <th scope="col" className={th}>
              Tasks
            </th>
            <th scope="col" className={th}>
              Tour
            </th>
            <th scope="col" className={th}>
              Last login
            </th>
            <th scope="col" className={th}>
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
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text">{fullName(s)}</p>
                    <p className="truncate text-muted">{s.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">{s.cohort ? <Badge tone="sky">{s.cohort.name}</Badge> : <span className="text-subtle">No cohort</span>}</td>
              <td className="px-4 py-3 whitespace-nowrap text-text">
                {s.doneTaskCount}/{s.taskCount} done
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
    <ul className="flex flex-col gap-3 xl:hidden">
      {students.map((s) => (
        <li key={s.id}>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Avatar firstName={s.firstName} lastName={s.lastName} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">{fullName(s)}</h2>
                <p className="truncate text-sm text-muted">{s.email}</p>
              </div>
              <RowActions student={s} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.cohort && <Badge tone="sky">{s.cohort.name}</Badge>}
              <TourBadge done={Boolean(s.tourCompletedAt)} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-subtle">Tasks</dt>
                <dd className="text-text">
                  {s.doneTaskCount}/{s.taskCount} done
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
    <div role="status">
      <span className="sr-only">Loading students</span>
      <Card className="hidden flex-col divide-y divide-line xl:flex">
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
      <div className="flex flex-col gap-3 xl:hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}
