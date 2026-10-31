import { createStudentSchema, updateStudentSchema, type StudentRow, type UpdateStudentInput } from "@kampus/shared";
import { useState, type FormEvent } from "react";
import { errorMessage, fieldErrors } from "../../api/client.ts";
import { useCohorts, useCreateStudent, useUpdateStudent } from "../../api/hooks.ts";
import { Button, Dialog, Input, Select, useToast } from "../../components/ui/index.ts";
import { fullName } from "../../lib/format.ts";

type FieldName = "firstName" | "lastName" | "email" | "cohortId" | "password";
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;

const FORM_ID = "student-form";

function initialValues(student: StudentRow | null): Values {
  return {
    firstName: student?.firstName ?? "",
    lastName: student?.lastName ?? "",
    email: student?.email ?? "",
    cohortId: student?.cohort?.id ?? "",
    password: "",
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

/** Dialog para criar (student = null) ou editar um aluno. O pai muda a `key` a cada abertura para repor o formulário. */
export function StudentFormDialog({ open, onOpenChange, student }: { open: boolean; onOpenChange: (open: boolean) => void; student: StudentRow | null }) {
  const isEdit = student !== null;
  const toast = useToast();
  const cohorts = useCohorts();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const [values, setValues] = useState<Values>(() => initialValues(student));
  const [errors, setErrors] = useState<Errors>({});

  const set = (field: FieldName) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const busy = createStudent.isPending || updateStudent.isPending;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!isEdit) {
        const parsed = createStudentSchema.safeParse(values);
        if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
        await createStudent.mutateAsync(parsed.data);
        toast({ title: "Student added", description: `${fullName(parsed.data)} can now log in.`, tone: "success" });
      } else {
        // Só envia o que mudou; a password só se vier preenchida.
        const changes: UpdateStudentInput = {};
        const base = initialValues(student);
        if (values.firstName !== base.firstName) changes.firstName = values.firstName;
        if (values.lastName !== base.lastName) changes.lastName = values.lastName;
        if (values.email !== base.email) changes.email = values.email;
        if (values.cohortId !== base.cohortId) changes.cohortId = values.cohortId;
        if (values.password) changes.password = values.password;
        if (Object.keys(changes).length === 0) {
          onOpenChange(false);
          return;
        }
        const parsed = updateStudentSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
        await updateStudent.mutateAsync({ id: student.id, ...parsed.data });
        toast({ title: "Changes saved", tone: "success" });
      }
      onOpenChange(false);
    } catch (error) {
      const fields = fieldErrors(error);
      if (Object.keys(fields).length > 0) setErrors(fields);
      toast({ title: isEdit ? "Couldn't save changes" : "Couldn't add student", description: errorMessage(error), tone: "error" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title={isEdit ? `Edit ${fullName(student)}` : "Add student"}
      description={isEdit ? "Update their details or set a new password." : "They'll get a student account on the campus app."}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy}>
            {isEdit ? "Save changes" : "Add student"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            autoComplete="off"
            required
            value={values.firstName}
            error={errors.firstName}
            onChange={(e) => set("firstName")(e.target.value)}
          />
          <Input
            label="Last name"
            autoComplete="off"
            required
            value={values.lastName}
            error={errors.lastName}
            onChange={(e) => set("lastName")(e.target.value)}
          />
        </div>
        <Input
          label="Email"
          type="email"
          autoComplete="off"
          required
          value={values.email}
          error={errors.email}
          onChange={(e) => set("email")(e.target.value)}
        />
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
        <Input
          label={isEdit ? "New password (optional)" : "Temporary password"}
          type="password"
          autoComplete="new-password"
          required={!isEdit}
          minLength={8}
          value={values.password}
          error={errors.password}
          hint={isEdit ? "Leave empty to keep their current password." : "Share it with the student. They can change it in their profile."}
          onChange={(e) => set("password")(e.target.value)}
        />
      </form>
    </Dialog>
  );
}
