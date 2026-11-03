import { loginSchema, PORTALS, type Portal, type PublicUser } from "@kampus/shared";
import { ArrowLeft, CircleAlert, Eye, EyeOff, Info, KeyRound, TriangleAlert, type LucideIcon } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ApiRequestError, errorMessage, fieldErrors } from "../../api/client.ts";
import { useLogin, useMe } from "../../api/hooks.ts";
import type { LoginRedirectState } from "../../components/layout/RequireAuth.tsx";
import { homePathFor, loginPath } from "../../components/layout/paths.ts";
import { Button, IconButton, Input, Logo, useToast } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { ExternalLink } from "./ExternalLink.tsx";
import { AUTHOR_URL, REPO_URL } from "./links.ts";
import { PublicBackdrop } from "./PublicBackdrop.tsx";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, useDemoLogin } from "./useDemoLogin.ts";

const COPY: Record<Portal, { title: string; panelTitle: string; panelText: string; label: string }> = {
  student: {
    title: "Student login",
    panelTitle: "Welcome to campus",
    panelText: "Your tour, your week and the right people to ask, all in one place.",
    label: "Student",
  },
  staff: {
    title: "Staff login",
    panelTitle: "Staff area",
    panelText: "Add new students and see who still needs a hand settling in.",
    label: "Staff",
  },
};

const PREFIX: Record<Portal, string> = { student: "/app", staff: "/staff" };

type FieldName = "email" | "password";

// Os três avisos do login com a mesma forma: cor e ícone dizem o tom, não só a cor.
const ALERT_TONES: Record<"info" | "error" | "warning", { className: string; icon: LucideIcon; iconClassName: string }> = {
  info: { className: "border-kampus-blue/20 bg-kampus-blue-soft text-kampus-navy", icon: Info, iconClassName: "text-kampus-blue" },
  error: { className: "border-danger/20 bg-danger-soft font-medium text-danger", icon: CircleAlert, iconClassName: "" },
  warning: { className: "border-warning/25 bg-warning-soft text-warning", icon: TriangleAlert, iconClassName: "" },
};

function Alert({ tone, role, children }: { tone: keyof typeof ALERT_TONES; role: "alert" | "status"; children: ReactNode }) {
  const { className, icon: Icon, iconClassName } = ALERT_TONES[tone];
  return (
    <div role={role} className={cn("flex items-start gap-2 rounded-xl border px-4 py-3 text-sm", className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", iconClassName)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function isPortal(value: unknown): value is Portal {
  return typeof value === "string" && (PORTALS as readonly string[]).includes(value);
}

/** Para onde ir depois de entrar: a página pedida, se for deste perfil e a visita já não estiver pendente. */
function targetAfterLogin(user: PublicUser, portal: Portal, from: string | undefined): string {
  const prefix = PREFIX[portal];
  const fromThisPortal = Boolean(from && (from === prefix || from.startsWith(`${prefix}/`) || from.startsWith(`${prefix}?`)));
  const tourPending = user.role === "student" && !user.tourCompletedAt && !user.tourSkippedAt;
  return from && fromThisPortal && !tourPending ? from : homePathFor(user);
}

export function LoginPage({ portal }: { portal: Portal }) {
  useDocumentTitle(portal === "staff" ? "Staff login" : "Student login");
  const copy = COPY[portal];
  const me = useMe();
  const login = useLogin();
  const demo = useDemoLogin();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = (location.state ?? null) as LoginRedirectState | null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [wrongPortal, setWrongPortal] = useState<Portal | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Já com sessão deste perfil: segue para casa (mas não durante/depois de um login feito aqui).
  if (me.data && me.data.role === portal && login.isIdle && demo.isIdle) {
    return <Navigate to={homePathFor(me.data)} replace />;
  }

  const resetMessages = () => {
    setFormError(null);
    setWrongPortal(null);
  };

  const focusField = (field: FieldName | undefined) => (field === "password" ? passwordRef : emailRef).current?.focus();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    const parsed = loginSchema.safeParse({ email, password, portal });
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === "email" || key === "password") && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      focusField(next.email ? "email" : "password");
      return;
    }
    setErrors({});
    login.mutate(parsed.data, {
      onSuccess: ({ user }) => {
        toast({ title: `Welcome back, ${user.firstName}!` });
        navigate(targetAfterLogin(user, portal, redirect?.from), { replace: true });
      },
      onError: (error) => {
        if (error instanceof ApiRequestError && error.status === 401) {
          setFormError("Wrong email or password.");
        } else if (error instanceof ApiRequestError && error.status === 403 && isPortal(error.body.correctPortal)) {
          setWrongPortal(error.body.correctPortal);
        } else if (error instanceof ApiRequestError && error.status === 400 && Object.keys(fieldErrors(error)).length > 0) {
          const fields = fieldErrors(error);
          setErrors({ email: fields.email, password: fields.password });
          if (!fields.email && !fields.password) setFormError(errorMessage(error));
          else focusField(fields.email ? "email" : "password");
        } else {
          setFormError(errorMessage(error));
        }
        // Volta a permitir o redirecionamento automático se já houver sessão.
        login.reset();
      },
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Painel de marca: faixa em cima no telemóvel, coluna à esquerda no desktop. */}
      <section aria-label={copy.panelTitle} className="relative overflow-hidden bg-kampus-gradient px-5 py-6 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:py-10">
        <PublicBackdrop />
        <Link to="/" className="focus-on-dark relative inline-flex rounded-lg" aria-label="Kampus, go to the welcome page">
          <Logo onDark />
        </Link>
        <div className="relative mt-6 max-w-md lg:mt-0">
          <p className="font-display text-2xl font-semibold text-white lg:text-4xl">{copy.panelTitle}</p>
          <p className="mt-2 text-sm text-white lg:text-lg">{copy.panelText}</p>
        </div>
        <p className="relative hidden text-xs text-white/80 lg:block">All data is fictional.</p>
      </section>

      <main className="flex flex-1 flex-col px-5 py-6 sm:px-10 lg:py-10">
        <Link to="/" className="-ml-2 inline-flex h-10 w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-kampus-blue hover:bg-kampus-blue-soft">
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <h1 className="text-3xl font-semibold">{copy.title}</h1>
          <p className="mt-1 text-muted">Log in with the email and password you were given.</p>

          {redirect?.reason === "session" && (
            <div className="mt-5">
              <Alert tone="info" role="status">
                Please log in to continue.
              </Alert>
            </div>
          )}

          <form noValidate onSubmit={submit} className="mt-6 flex flex-col gap-4">
            {(formError || wrongPortal) && (
            <div>
              {formError && (
                <Alert tone="error" role="alert">
                  {formError}
                </Alert>
              )}
              {wrongPortal && (
                <Alert tone="warning" role="alert">
                  <p className="font-semibold">This is a {wrongPortal} account.</p>
                  <Link to={loginPath(wrongPortal)} className="mt-1 inline-block font-semibold text-kampus-navy underline underline-offset-2">
                    Go to {COPY[wrongPortal].label} login
                  </Link>
                </Alert>
              )}
            </div>
            )}

            <Input
              ref={emailRef}
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              error={errors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />

            <div className="relative">
              <Input
                ref={passwordRef}
                label="Password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                className="pr-12"
                value={password}
                error={errors.password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
              />
              {/* Alinhado com o input: rótulo (20px) + espaço (6px) + 4px. */}
              <IconButton
                label={showPassword ? "Hide password" : "Show password"}
                icon={showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                size="sm"
                className="absolute top-[30px] right-1"
                onClick={() => setShowPassword((v) => !v)}
              />
            </div>

            <Button type="submit" size="lg" loading={login.isPending} disabled={demo.isPending} className="mt-2 w-full">
              Log in
            </Button>
          </form>

          <aside aria-label="Demo account" className="mt-8 rounded-[var(--radius-card)] border border-line bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <KeyRound aria-hidden className="size-4 text-kampus-blue" />
              <h2 className="text-base font-semibold">Demo account</h2>
            </div>
            <p className="mt-1 text-sm text-muted">This is a portfolio project. Use this account to look around.</p>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt className="text-subtle">Email</dt>
              <dd className="truncate font-medium text-text">{DEMO_ACCOUNTS[portal]}</dd>
              <dt className="text-subtle">Password</dt>
              <dd className="font-medium text-text">{DEMO_PASSWORD}</dd>
            </dl>
            <Button variant="secondary" size="sm" className="mt-4" loading={demo.isPending} disabled={login.isPending} onClick={() => demo.start(portal, (user) => targetAfterLogin(user, portal, redirect?.from))}>
              Explore with the demo account
            </Button>
          </aside>
        </div>

        <p className="text-center text-sm text-muted">
          A portfolio project by <ExternalLink href={AUTHOR_URL} className="whitespace-nowrap text-kampus-blue">David Lucca</ExternalLink>
          <span aria-hidden> · </span>
          <span className="sr-only">. </span>
          <ExternalLink href={REPO_URL} className="whitespace-nowrap text-kampus-blue">
            Code on GitHub
          </ExternalLink>
        </p>
      </main>
    </div>
  );
}
