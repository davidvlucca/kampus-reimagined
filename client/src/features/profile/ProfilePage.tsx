import { changePasswordSchema, DEMO_ACCOUNT_MESSAGES, updateProfileSchema, type PublicUser, isProtectedDemoEmail } from "@kampus/shared";
import { ArrowRight, BadgeCheck, CheckCircle2, KeyRound, ListChecks, Lock, LogOut, Map as MapIcon, UserRound, Users } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router";
import { ApiRequestError, errorMessage, fieldErrors } from "../../api/client.ts";
import { useChangePassword, useContacts, useCurrentUser, useLogout, useTasks, useUpdateProfile } from "../../api/hooks.ts";
import { loginPath } from "../../components/layout/paths.ts";
import { Avatar, Badge, Button, buttonClasses, Card, CardBody, CardHeader, Input, PageHeader, ProgressBar, Skeleton, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { isProgramManager } from "../contacts/contactGroups.ts";
import { formatDate, fullName } from "../../lib/format.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";

// Com texto a 200% num ecrã de 320px, um botão de uma linha só ficava mais largo do que o ecrã.
const WRAP = "h-auto min-h-11 max-w-full py-2 text-center whitespace-normal";

/** Mostra os erros e põe o foco no primeiro campo inválido (o leitor de ecrã lê logo o erro). */
function showErrors(form: HTMLFormElement | null, setErrors: (errors: Record<string, string>) => void, errors: Record<string, string>) {
  flushSync(() => setErrors(errors));
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/** Primeira mensagem de erro por campo, a partir dos issues do Zod. */
function issuesByField(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function ProfileSummary({ user, className }: { user: PublicUser; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div aria-hidden className="h-16 bg-kampus-gradient" />
      <CardBody className="-mt-12 flex flex-col items-start">
        <Avatar firstName={user.firstName} lastName={user.lastName} size="xl" className="ring-4 ring-card" />
        <h2 className="clip-marks mt-3 max-w-full text-2xl font-semibold break-words">{fullName(user)}</h2>
        <p className="mt-0.5 text-sm break-all text-muted">{user.email}</p>
        {/* A data de início da turma não vem na API (só o nome): fica de fora em vez de inventada. */}
        <div className="mt-3 flex flex-wrap gap-2">
          {user.role === "student" ? (
            <Badge tone="blue" icon={<Users aria-hidden />} className="px-3 py-1">
              {user.cohort?.name ?? "Student"}
            </Badge>
          ) : (
            <Badge tone="blue" icon={<BadgeCheck aria-hidden />} className="px-3 py-1">
              {user.staffTitle ?? "Staff"}
            </Badge>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function DetailsForm({ user, className }: { user: PublicUser; className?: string }) {
  const update = useUpdateProfile();
  const toast = useToast();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useSubmitLock();
  const formRef = useRef<HTMLFormElement>(null);

  const dirty = firstName.trim() !== user.firstName || lastName.trim() !== user.lastName;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ firstName, lastName });
    if (!parsed.success) {
      showErrors(formRef.current, setErrors, issuesByField(parsed.error.issues));
      return;
    }
    setErrors({});
    void lock(() =>
      update.mutateAsync(parsed.data).then(
        ({ user: saved }) => {
          setFirstName(saved.firstName);
          setLastName(saved.lastName);
          toast({ title: "Changes saved" });
        },
        (error: unknown) => {
          showErrors(formRef.current, setErrors, fieldErrors(error));
          toast({ title: "Couldn't save your changes", description: errorMessage(error), tone: "error" });
        },
      ),
    );
  };

  return (
    <Card className={className}>
      <CardHeader
        icon={<UserRound aria-hidden />}
        title="Account"
        description={user.role === "student" ? "Your team sees this name on the student list." : "Your name as it appears across Kampus."}
      />
      <CardBody>
        <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              error={errors.firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last name"
              name="lastName"
              autoComplete="family-name"
              value={lastName}
              error={errors.lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-kampus-navy">Email</p>
            <p className="mt-1 text-[0.9375rem] break-all text-text">{user.email}</p>
            {user.role === "student" && <EmailHint />}
          </div>
          <div>
            <Button type="submit" loading={update.isPending} disabled={!dirty} className={WRAP}>
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

const emptyPasswords = { currentPassword: "", newPassword: "", confirmPassword: "" };

function PasswordForm({ email, className }: { email: string; className?: string }) {
  const change = useChangePassword();
  const toast = useToast();
  const [values, setValues] = useState(emptyPasswords);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useSubmitLock();
  const formRef = useRef<HTMLFormElement>(null);
  // A conta da demo é partilhada: o servidor recusa mudar a password, por isso o formulário nem abre.
  const demo = isProtectedDemoEmail(email);

  const set = (field: keyof typeof emptyPasswords) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = changePasswordSchema.safeParse({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    const next = parsed.success ? {} : issuesByField(parsed.error.issues);
    if (!values.confirmPassword) next.confirmPassword = "Required";
    else if (values.confirmPassword !== values.newPassword) next.confirmPassword = "Passwords don't match";
    if (!parsed.success || Object.keys(next).length > 0) {
      showErrors(formRef.current, setErrors, next);
      return;
    }
    setErrors({});
    // Um duplo clique mudava a password e logo a seguir dava "password atual errada".
    void lock(() =>
      change.mutateAsync(parsed.data).then(
        () => {
          setValues(emptyPasswords);
          toast({ title: "Password changed. You were logged out on other devices." });
        },
        (error: unknown) => {
          if (error instanceof ApiRequestError && error.status === 400) {
            const fields = fieldErrors(error);
            showErrors(formRef.current, setErrors, Object.keys(fields).length > 0 ? fields : { currentPassword: errorMessage(error) });
          }
          toast({ title: "Couldn't change your password", description: errorMessage(error), tone: "error" });
        },
      ),
    );
  };

  return (
    <Card className={className}>
      <CardHeader icon={<KeyRound aria-hidden />} title="Password" />
      <CardBody>
        <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
          {demo && (
            <p id="demo-password-hint" className="flex gap-2.5 rounded-xl border border-kampus-blue/20 bg-kampus-blue-soft px-4 py-3 text-sm text-kampus-navy">
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
              {DEMO_ACCOUNT_MESSAGES.ownPassword}
            </p>
          )}
          <fieldset disabled={demo} aria-describedby={demo ? "demo-password-hint" : undefined} className="flex min-w-0 flex-col gap-4">
            <legend className="sr-only">Change password</legend>
            <Input
              label="Current password"
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              value={values.currentPassword}
              error={errors.currentPassword || undefined}
              onChange={(e) => set("currentPassword")(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
              <Input
                label="New password"
                type="password"
                name="newPassword"
                autoComplete="new-password"
                hint="At least 8 characters"
                value={values.newPassword}
                error={errors.newPassword || undefined}
                onChange={(e) => set("newPassword")(e.target.value)}
              />
              <Input
                label="Confirm new password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={values.confirmPassword}
                error={errors.confirmPassword || undefined}
                onChange={(e) => set("confirmPassword")(e.target.value)}
              />
            </div>
            <div>
              <Button type="submit" loading={change.isPending} className={WRAP}>
                Change password
              </Button>
            </div>
          </fieldset>
        </form>
      </CardBody>
    </Card>
  );
}

/** Como no cartão de tarefas do Home: as tarefas mais a visita, "N of M steps done". */
function ChecklistRow({ tourDone }: { tourDone: boolean }) {
  const all = useTasks("all");
  const open = useTasks("open");
  let summary: ReactNode;
  if (all.isPending)
    summary = (
      <div role="status" className="flex flex-col gap-1.5">
        <span className="sr-only">Loading progress</span>
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  else if (all.isError) summary = <p className="text-sm text-muted">Couldn't load your tasks.</p>;
  else {
    const total = all.data.length + 1;
    const done = all.data.filter((t) => t.done).length + (tourDone ? 1 : 0);
    const next = open.data?.[0];
    summary = (
      <>
        <ProgressBar value={done} max={total} label="Your progress" className="h-1.5" />
        <p className="text-sm text-muted">
          <span className="font-semibold text-kampus-navy">
            {done} of {total}
          </span>{" "}
          steps done{next && <span className="break-words"> · next: {next.title}</span>}
        </p>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-[0.9375rem] font-semibold">Day 1 checklist</h3>
        {summary}
      </div>
      <Link to="/app/tasks" className={buttonClasses({ variant: "secondary", className: `self-start sm:self-center ${WRAP}` })}>
        <ArrowRight aria-hidden className="size-4" />
        See tasks
      </Link>
    </div>
  );
}

function OnboardingCard({ user, className }: { user: PublicUser; className?: string }) {
  const done = Boolean(user.tourCompletedAt);
  return (
    <Card className={className}>
      <CardHeader icon={<ListChecks aria-hidden />} title="Your onboarding" description="What to sort out before your first day." />
      <CardBody className="flex flex-col gap-4">
        <ChecklistRow tourDone={done} />
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-[0.9375rem] font-semibold">Campus tour</h3>
            {user.tourCompletedAt ? (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-success">
                <CheckCircle2 aria-hidden className="size-4" />
                Completed {formatDate(user.tourCompletedAt)}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted">{user.tourSkippedAt ? "Skipped for now" : "Not taken yet"}</p>
            )}
          </div>
          <Link to="/app/tour" className={buttonClasses({ variant: done ? "secondary" : "primary", className: `self-start sm:self-center ${WRAP}` })}>
            <MapIcon aria-hidden className="size-4" />
            {done ? "Take the tour again" : "Take the tour"}
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

/** Quem muda o email é o staff: com a Program Manager na lista, diz-se o nome. */
function EmailHint() {
  const contacts = useContacts();
  const manager = contacts.data?.find(isProgramManager);
  return (
    <p className="mt-1 text-xs text-subtle">
      {manager ? `To change your email, ask ${fullName(manager)}, your ${manager.title}.` : "Ask staff to change your email."}
    </p>
  );
}

export function ProfilePage() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const toast = useToast();

  const signOut = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        navigate(loginPath(user.role), { replace: true });
        toast({ title: "You're logged out", tone: "info" });
      },
      onError: (e) => toast({ title: "Couldn't log out", description: errorMessage(e), tone: "error" }),
    });

  const student = user.role === "student";
  // Ecrã largo: duas colunas com posições fixas. No telemóvel fica a ordem do DOM (resumo,
  // onboarding, conta, password, Log out), que é também a ordem de leitura.
  const place = student
    ? { summary: "lg:col-start-1 lg:row-start-1", account: "lg:col-start-1 lg:row-start-2", password: "lg:col-start-2 lg:row-start-2 lg:row-span-2", logout: "lg:col-start-1 lg:row-start-3" }
    : { summary: "lg:col-start-1 lg:row-start-1", account: "lg:col-start-2 lg:row-start-1", password: "lg:col-start-2 lg:row-start-2 lg:row-span-2", logout: "lg:col-start-1 lg:row-start-2" };

  return (
    <>
      <PageHeader title="Your profile" description={student ? "Your details, password and how your onboarding is going." : "Your details, password and session."} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfileSummary user={user} className={place.summary} />
        {student && <OnboardingCard user={user} className="lg:col-start-2 lg:row-start-1" />}
        <DetailsForm user={user} className={`self-start ${place.account}`} />
        <PasswordForm email={user.email} className={`self-start ${place.password}`} />
        <Button
          variant="secondary"
          loading={logout.isPending}
          icon={<LogOut aria-hidden className="size-4" />}
          onClick={signOut}
          className={`w-full self-start ${WRAP} ${place.logout}`}
        >
          Log out
        </Button>
      </div>
    </>
  );
}
