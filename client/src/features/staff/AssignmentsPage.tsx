import type { Assignment } from "@kampus/shared";
import { ChevronDown, ClipboardList, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useAssignment, useAssignments, useCohorts, useDeleteAssignment } from "../../api/hooks.ts";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Select,
  Skeleton,
  SkeletonList,
  useToast,
} from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { fullName } from "../../lib/format.ts";
import { AssignmentFormDialog } from "./AssignmentFormDialog.tsx";
import { AssignmentDeadline, AssignmentProgress } from "./AssignmentProgress.tsx";
import { cohortFilter } from "./cohortFilter.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Tarefas que o staff dá a uma turma inteira: criar, editar, apagar e ver quem já as fez. */
export function AssignmentsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const cohorts = useCohorts();
  const cohortId = cohortFilter(params.get("cohort"), cohorts.data);
  const assignments = useAssignments(cohortId || undefined);
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

  const cohortName = cohorts.data?.find((c) => c.id === cohortId)?.name;
  const list = assignments.data;

  return (
    <>
      <PageHeader
        title="Cohort tasks"
        description="Give a whole cohort a task and see who has done it."
        actions={
          <Button icon={<Plus aria-hidden className="size-4" />} onClick={openCreate}>
            New task
          </Button>
        }
      />

      <div role="search" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
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
        {list ? plural(list.length, "task") : ""}
      </p>

      {assignments.isPending ? (
        <AssignmentsSkeleton />
      ) : assignments.isError ? (
        <Card>
          <ErrorState message={errorMessage(assignments.error)} onRetry={() => assignments.refetch()} />
        </Card>
      ) : assignments.data.length === 0 ? (
        <Card>
          {cohortId ? (
            <EmptyState
              icon={<SearchX aria-hidden />}
              title={cohortName ? `No tasks for ${cohortName}` : "No tasks for this cohort"}
              description="Add one, or look at every cohort."
              action={
                <Button variant="secondary" onClick={() => setCohort("")}>
                  Show all cohorts
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ClipboardList aria-hidden />}
              title="No cohort tasks yet"
              description="Add a task, like handing in a form, and every student in the cohort gets it."
              action={
                <Button icon={<Plus aria-hidden className="size-4" />} onClick={openCreate}>
                  New task
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <ul className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {assignments.data.map((a) => (
            <li key={a.id}>
              <AssignmentCard assignment={a} onEdit={openEdit} onDelete={setDeleting} />
            </li>
          ))}
        </ul>
      )}

      <AssignmentFormDialog key={formKey} open={formOpen} onOpenChange={setFormOpen} assignment={editing} defaultCohortId={cohortId} />

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

function AssignmentCard({
  assignment: a,
  onEdit,
  onDelete,
}: {
  assignment: Assignment;
  onEdit: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
}) {
  const [showWho, setShowWho] = useState(false);
  const listId = `assignment-${a.id}-students`;
  // A mesma tarefa pode estar em várias turmas: a turma entra nos nomes para os distinguir.
  const named = `"${a.title}" for ${a.cohort.name}`;

  return (
    <Card className="p-4 sm:p-5">
      {/* flex-wrap: com o texto a 200% os botões passam para baixo em vez de espremer o título. */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[min(100%,10rem)] flex-1">
          <h2 className="text-base font-semibold break-words">
            {a.title}
            <span className="sr-only">, {a.cohort.name}</span>
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="sky" className="max-w-full rounded-xl whitespace-normal break-words">
              {a.cohort.name}
            </Badge>
            <AssignmentDeadline assignment={a} />
          </div>
        </div>
        <div className="-mt-1 -mr-1 ml-auto flex shrink-0 gap-1">
          <IconButton label={`Edit ${named}`} icon={<Pencil aria-hidden />} onClick={() => onEdit(a)} />
          <IconButton label={`Delete ${named}`} variant="danger" icon={<Trash2 aria-hidden />} onClick={() => onDelete(a)} />
        </div>
      </div>

      <AssignmentProgress assignment={a} className="mt-4" />

      {a.students > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 -ml-2"
            aria-expanded={showWho}
            aria-controls={listId}
            icon={<ChevronDown aria-hidden className={cn("size-4 transition", showWho && "rotate-180")} />}
            onClick={() => setShowWho((v) => !v)}
          >
            {/* Rótulo fixo: o estado vem do aria-expanded; o título distingue os cartões. */}
            See who
            <span className="sr-only"> has done {named}</span>
          </Button>
          <div id={listId} hidden={!showWho}>
            {showWho && <StudentProgress assignment={a} />}
          </div>
        </>
      )}
    </Card>
  );
}

/** Quem já fez a tarefa: vem do detalhe, que só se pede ao abrir. A API põe primeiro quem ainda não a fez. */
function StudentProgress({ assignment }: { assignment: Assignment }) {
  const detail = useAssignment(assignment.id, true);

  if (detail.isPending) return <SkeletonList rows={3} className="mt-3" label={`Loading students for "${assignment.title}" in ${assignment.cohort.name}`} />;
  if (detail.isError) return <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} className="py-6" />;
  if (detail.data.progress.length === 0) return <p className="mt-3 text-sm text-muted">No students in this cohort yet.</p>;

  return (
    <ul aria-label={`Students in ${assignment.cohort.name}`} className="mt-3 flex flex-col divide-y divide-line border-t border-line">
      {detail.data.progress.map(({ student, done }) => (
        <li key={student.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0 truncate text-sm font-medium text-text">{fullName(student)}</span>
          {done ? <Badge tone="success">Done</Badge> : <Badge tone="warning">Not yet</Badge>}
        </li>
      ))}
    </ul>
  );
}

function AssignmentsSkeleton() {
  return (
    <div role="status" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <span className="sr-only">Loading cohort tasks</span>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-44 rounded-[var(--radius-card)]" />
      ))}
    </div>
  );
}
