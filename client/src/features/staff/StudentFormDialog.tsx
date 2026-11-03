import { createStudentSchema, isProtectedDemoEmail, updateStudentSchema, type StudentRow, type UpdateStudentInput } from "@kampus/shared";
import { useRef, useState, type FormEvent } from "react";
import { errorMessage, fieldErrors, isNotFound } from "../../api/client.ts";
import { useCohorts, useCreateStudent, useUpdateStudent } from "../../api/hooks.ts";
import { Button, Dialog, Input, Select, useToast } from "../../components/ui/index.ts";
import { fullName } from "../../lib/format.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";

type FieldName = "firstName" | "lastName" | "email" | "cohortId" | "password";
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;

const FORM_ID = "student-form";
/** A ordem dos campos no formulário: o foco vai para o primeiro com erro. */
const FIELD_ORDER: FieldName[] = ["firstName", "lastName", "email", "cohortId", "password"];

// O Zod diz só "Required"; aqui diz-se o que falta.
const REQUIRED: Record<FieldName, string> = {
  firstName: "Enter a first name",
  lastName: "Enter a last name",
  email: "Enter an email",
  cohortId: "Choose a cohort",
  password: "Enter a temporary password",
};

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
    if (typeof key === "string" && !(key in errors)) {
      const field = key as FieldName;
      errors[field] = issue.message === "Required" ? REQUIRED[field] : issue.message;
    }
  }
  return errors;
}

/** Um campo vazio diz o que falta ("Enter an email"), não a regra de formato. */
function withEmptyMessages(errors: Errors, values: Values): Errors {
  const next = { ...errors };
  for (const field of FIELD_ORDER) {
    if (next[field] && values[field].trim() === "") next[field] = REQUIRED[field];
  }
  return next;
}

/** Dialog para criar (student = null) ou editar um aluno. O pai muda a `key` a cada abertura para repor o formulário. */
export function StudentFormDialog({ open, onOpenChange, student }: { open: boolean; onOpenChange: (open: boolean) => void; student: StudentRow | null }) {
  const isEdit = student !== null;
  // A conta partilhada da demo: a API recusa mudar o email e a password, por isso nem se deixa tentar.
  const isDemo = student !== null && isProtectedDemoEmail(student.email);
  const toast = useToast();
  const cohorts = useCohorts();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const [values, setValues] = useState<Values>(() => initialValues(student));
  const [errors, setErrors] = useState<Errors>({});
  const lock = useSubmitLock();
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLInputElement | HTMLSelectElement | null>>>({});

  /** Mostra os erros e leva o foco ao primeiro campo com erro. */
  const showErrors = (next: Errors) => {
    setErrors(next);
    const first = FIELD_ORDER.find((f) => next[f]);
    if (first) fieldRefs.current[first]?.focus();
  };

  const set = (field: FieldName) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const busy = createStudent.isPending || updateStudent.isPending;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Um duplo clique não cria dois (ver useSubmitLock).
    await lock(async () => {
      try {
        if (!isEdit) {
          const parsed = createStudentSchema.safeParse(values);
          if (!parsed.success) return showErrors(withEmptyMessages(issuesToErrors(parsed.error.issues), values));
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
          if (!parsed.success) return showErrors(withEmptyMessages(issuesToErrors(parsed.error.issues), values));
          await updateStudent.mutateAsync({ id: student.id, ...parsed.data });
          toast({ title: "Changes saved", tone: "success" });
        }
        onOpenChange(false);
      } catch (error) {
        // Apagado entretanto (noutro separador ou por outra pessoa): fecha, a lista já se atualiza.
        if (isEdit && isNotFound(error)) onOpenChange(false);
        const fields = fieldErrors(error);
        if (Object.keys(fields).length > 0) showErrors(fields);
        toast({ title: isEdit ? "Couldn't save changes" : "Couldn't add student", description: errorMessage(error), tone: "error" });
      }
    });
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
        {isDemo && (
          <p className="rounded-xl border border-kampus-blue/20 bg-kampus-blue-soft px-4 py-3 text-sm text-kampus-navy">
            This is the shared demo account. You can change the name and cohort, but not the email or password.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            ref={(el) => {
              fieldRefs.current.firstName = el;
            }}
            label="First name"
            autoComplete="off"
            required
            value={values.firstName}
            error={errors.firstName}
            onChange={(e) => set("firstName")(e.target.value)}
          />
          <Input
            ref={(el) => {
              fieldRefs.current.lastName = el;
            }}
            label="Last name"
            autoComplete="off"
            required
            value={values.lastName}
            error={errors.lastName}
            onChange={(e) => set("lastName")(e.target.value)}
          />
        </div>
        <Input
          ref={(el) => {
            fieldRefs.current.email = el;
          }}
          label="Email"
          type="email"
          autoComplete="off"
          required
          disabled={isDemo}
          value={values.email}
          error={errors.email}
          onChange={(e) => set("email")(e.target.value)}
        />
        <Select
          ref={(el) => {
            fieldRefs.current.cohortId = el;
          }}
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
          ref={(el) => {
            fieldRefs.current.password = el;
          }}
          label={isEdit ? "New password (optional)" : "Temporary password"}
          disabled={isDemo}
          type="password"
          autoComplete="new-password"
          required={!isEdit}
          minLength={8}
          value={values.password}
          error={errors.password}
          hint={
            isDemo
              ? "Locked on the shared demo account."
              : isEdit
                ? "Leave empty to keep their current password."
                : "Share it with the student. They can change it in their profile."
          }
          onChange={(e) => set("password")(e.target.value)}
        />
      </form>
    </Dialog>
  );
}
