import { createAssignmentSchema, updateAssignmentSchema, type Assignment, type UpdateAssignmentInput } from "@kampus/shared";
import { CalendarX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorMessage, fieldErrors } from "../../api/client.ts";
import { useCohorts, useCreateAssignment, useUpdateAssignment } from "../../api/hooks.ts";
import { Button, Dialog, Input, Select, useToast } from "../../components/ui/index.ts";

type FieldName = "cohortId" | "title" | "dueDate";
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;

const FORM_ID = "assignment-form";

function initialValues(assignment: Assignment | null, defaultCohortId: string): Values {
  return {
    cohortId: assignment?.cohort.id ?? defaultCohortId,
    title: assignment?.title ?? "",
    dueDate: assignment?.dueDate ?? "",
  };
}

/** Primeiro erro de cada campo, a partir dos issues do Zod. */
function issuesToErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Errors {
  const errors: Errors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) errors[key as FieldName] = issue.message;
  }
  return errors;
}

/**
 * Dialog para criar (assignment = null) ou editar uma tarefa da turma. O pai muda a `key` a cada abertura.
 * A turma só se escolhe ao criar; ao editar aparece só para leitura (a API não a deixa mudar).
 */
export function AssignmentFormDialog({
  open,
  onOpenChange,
  assignment,
  defaultCohortId = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  /** Ao criar, começa com a turma do filtro da página. */
  defaultCohortId?: string;
}) {
  const isEdit = assignment !== null;
  const toast = useToast();
  const cohorts = useCohorts();
  const createAssignment = useCreateAssignment();
  const updateAssignment = useUpdateAssignment();
  const [values, setValues] = useState<Values>(() => initialValues(assignment, defaultCohortId));
  const [errors, setErrors] = useState<Errors>({});

  const set = (field: FieldName) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const busy = createAssignment.isPending || updateAssignment.isPending;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!isEdit) {
        const parsed = createAssignmentSchema.safeParse({ ...values, dueDate: values.dueDate || null });
        if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
        const created = await createAssignment.mutateAsync(parsed.data);
        toast({ title: "Task added", description: `Everyone in ${created.cohort.name} can see it now.`, tone: "success" });
      } else {
        // Só envia o que mudou.
        const changes: UpdateAssignmentInput = {};
        const base = initialValues(assignment, "");
        if (values.title.trim() !== base.title) changes.title = values.title;
        if (values.dueDate !== base.dueDate) changes.dueDate = values.dueDate || null;
        if (Object.keys(changes).length === 0) {
          onOpenChange(false);
          return;
        }
        const parsed = updateAssignmentSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
        await updateAssignment.mutateAsync({ id: assignment.id, ...parsed.data });
        toast({ title: "Changes saved", tone: "success" });
      }
      onOpenChange(false);
    } catch (error) {
      const fields = fieldErrors(error);
      if (Object.keys(fields).length > 0) setErrors(fields);
      toast({ title: isEdit ? "Couldn't save changes" : "Couldn't add the task", description: errorMessage(error), tone: "error" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title={isEdit ? "Edit cohort task" : "New cohort task"}
      description={isEdit ? "Changes show up for every student in the cohort." : "Every student in the cohort gets it in their task list."}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy}>
            {isEdit ? "Save changes" : "Add task"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {isEdit ? (
          <Input label="Cohort" value={assignment.cohort.name} readOnly hint="The cohort can't change. Delete the task and add a new one instead." />
        ) : (
          <Select
            label="Cohort"
            required
            value={values.cohortId}
            error={errors.cohortId ?? (cohorts.isError ? "Couldn't load cohorts. Close and try again." : undefined)}
            disabled={cohorts.isPending}
            onChange={(e) => set("cohortId")(e.target.value)}
          >
            <option value="" disabled>
              {cohorts.isPending ? "Loading cohorts…" : "Choose a cohort"}
            </option>
            {cohorts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Input
          label="Title"
          placeholder="e.g. Hand in your housing form"
          autoComplete="off"
          required
          maxLength={120}
          value={values.title}
          error={errors.title}
          onChange={(e) => set("title")(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <Input label="Due date" type="date" hint="Optional" value={values.dueDate} error={errors.dueDate} onChange={(e) => set("dueDate")(e.target.value)} />
          {values.dueDate && (
            <Button variant="ghost" size="sm" className="self-start" icon={<CalendarX aria-hidden className="size-4" />} onClick={() => set("dueDate")("")}>
              Remove due date
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
