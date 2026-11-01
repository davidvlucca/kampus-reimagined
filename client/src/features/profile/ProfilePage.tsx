import { changePasswordSchema, updateProfileSchema, type PublicUser, isProtectedDemoEmail } from "@kampus/shared";
import { CheckCircle2, KeyRound, LogOut, Map as MapIcon, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ApiRequestError, errorMessage, fieldErrors } from "../../api/client.ts";
import { useChangePassword, useCurrentUser, useLogout, useUpdateProfile } from "../../api/hooks.ts";
import { loginPath } from "../../components/layout/paths.ts";
import { Avatar, Badge, Button, buttonClasses, Card, CardBody, CardHeader, Input, PageHeader, useToast } from "../../components/ui/index.ts";
import { formatDate, fullName } from "../../lib/format.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";

/** Primeira mensagem de erro por campo, a partir dos issues do Zod. */
function issuesByField(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function ProfileSummary({ user }: { user: PublicUser }) {
  const badge = user.role === "student" ? (user.cohort?.name ?? "Student") : (user.staffTitle ?? "Staff");
  return (
    <Card className="overflow-hidden">
      <div aria-hidden className="h-16 bg-kampus-gradient" />
      <CardBody className="-mt-12 flex flex-col items-center text-center">
        <Avatar firstName={user.firstName} lastName={user.lastName} size="xl" className="ring-4 ring-card" />
        <h2 className="clip-marks mt-3 max-w-full text-xl font-semibold break-words">{fullName(user)}</h2>
        <p className="mt-0.5 text-sm break-all text-muted">{user.email}</p>
        <Badge tone="sky" className="mt-3">
          {badge}
        </Badge>
      </CardBody>
    </Card>
  );
}

function DetailsForm({ user }: { user: PublicUser }) {
  const update = useUpdateProfile();
  const toast = useToast();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useSubmitLock();

  const dirty = firstName.trim() !== user.firstName || lastName.trim() !== user.lastName;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ firstName, lastName });
    if (!parsed.success) {
      setErrors(issuesByField(parsed.error.issues));
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
          setErrors(fieldErrors(error));
          toast({ title: "Couldn't save your changes", description: errorMessage(error), tone: "error" });
        },
      ),
    );
  };

  return (
    <Card>
      <CardHeader icon={<UserRound aria-hidden />} title="Your details" description="This is how staff see you." />
      <CardBody>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
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
            {user.role === "student" && <p className="mt-1 text-xs text-subtle">Ask staff to change your email.</p>}
          </div>
          <div>
            <Button type="submit" loading={update.isPending} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

const emptyPasswords = { currentPassword: "", newPassword: "", confirmPassword: "" };

function PasswordForm({ email }: { email: string }) {
  const change = useChangePassword();
  const toast = useToast();
  const [values, setValues] = useState(emptyPasswords);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useSubmitLock();

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
      setErrors(next);
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
            setErrors(Object.keys(fields).length > 0 ? fields : { currentPassword: errorMessage(error) });
          }
          toast({ title: "Couldn't change your password", description: errorMessage(error), tone: "error" });
        },
      ),
    );
  };

  return (
    <Card>
      <CardHeader icon={<KeyRound aria-hidden />} title="Change password" />
      <CardBody>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {isProtectedDemoEmail(email) && (
            <p className="rounded-xl border border-kampus-blue/20 bg-kampus-blue-soft px-4 py-3 text-sm text-kampus-navy">
              You're using a shared demo account, so its password can't be changed.
            </p>
          )}
          <Input
            label="Current password"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={values.currentPassword}
            error={errors.currentPassword || undefined}
            onChange={(e) => set("currentPassword")(e.target.value)}
          />
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
          <div>
            <Button type="submit" loading={change.isPending}>
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function TourRow({ user }: { user: PublicUser }) {
  const done = Boolean(user.tourCompletedAt);
  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-kampus-blue-soft text-kampus-blue">
            <MapIcon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Campus tour</h2>
            {user.tourCompletedAt ? (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-success">
                <CheckCircle2 aria-hidden className="size-4" />
                Completed {formatDate(user.tourCompletedAt)}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted">Not taken yet</p>
            )}
          </div>
        </div>
        <Link to="/app/tour" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          {done ? "Take the tour again" : "Take the tour"}
        </Link>
      </CardBody>
    </Card>
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

  return (
    <>
      <PageHeader title="Your profile" description="Your details, password and session." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <ProfileSummary user={user} />
          {user.role === "student" && <TourRow user={user} />}
          <Button variant="secondary" loading={logout.isPending} icon={<LogOut aria-hidden className="size-4" />} onClick={signOut} className="w-full">
            Log out
          </Button>
        </div>
        <div className="flex flex-col gap-6">
          <DetailsForm user={user} />
          <PasswordForm email={user.email} />
        </div>
      </div>
    </>
  );
}
