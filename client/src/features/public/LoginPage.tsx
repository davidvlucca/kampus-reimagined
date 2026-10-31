import { loginSchema, PORTALS, type Portal, type PublicUser } from "@kampus/shared";
import { ArrowLeft, Eye, EyeOff, Info, KeyRound } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ApiRequestError, errorMessage, fieldErrors } from "../../api/client.ts";
import { useLogin, useMe } from "../../api/hooks.ts";
import type { LoginRedirectState } from "../../components/layout/RequireAuth.tsx";
import { homePathFor, loginPath } from "../../components/layout/paths.ts";
import { Button, IconButton, Input, Logo, useToast } from "../../components/ui/index.ts";
import { PublicBackdrop } from "./PublicBackdrop.tsx";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";

const COPY: Record<Portal, { title: string; panelTitle: string; panelText: string; demoEmail: string; label: string }> = {
  student: {
    title: "Student login",
    panelTitle: "Welcome to campus",
    panelText: "Your tour, your week and the right people to ask, all in one place.",
    demoEmail: "student@example.com",
    label: "Student",
  },
  staff: {
    title: "Staff login",
    panelTitle: "Staff area",
    panelText: "Add new students and see who still needs a hand settling in.",
    demoEmail: "staff@example.com",
    label: "Staff",
  },
};

const PREFIX: Record<Portal, string> = { student: "/app", staff: "/staff" };
const DEMO_PASSWORD = "Kampus123";

type FieldName = "email" | "password";

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
  if (me.data && me.data.role === portal && login.isIdle) {
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

  const fillDemo = () => {
    setEmail(copy.demoEmail);
    setPassword(DEMO_PASSWORD);
    setErrors({});
    resetMessages();
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
            <p role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-kampus-blue/20 bg-kampus-blue-soft px-4 py-3 text-sm text-kampus-navy">
              <Info aria-hidden className="size-4 shrink-0 text-kampus-blue" />
              Please log in to continue.
            </p>
          )}

          <form noValidate onSubmit={submit} className="mt-6 flex flex-col gap-4">
            {(formError || wrongPortal) && (
            <div>
              {formError && (
                <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                  {formError}
                </p>
              )}
              {wrongPortal && (
                <div role="alert" className="rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
                  <p className="font-semibold">This is a {wrongPortal} account.</p>
                  <Link to={loginPath(wrongPortal)} className="mt-1 inline-block font-semibold text-kampus-navy underline underline-offset-2">
                    Go to {COPY[wrongPortal].label} login
                  </Link>
                </div>
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

            <Button type="submit" size="lg" loading={login.isPending} className="mt-2 w-full">
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
              <dd className="truncate font-medium text-text">{copy.demoEmail}</dd>
              <dt className="text-subtle">Password</dt>
              <dd className="font-medium text-text">{DEMO_PASSWORD}</dd>
            </dl>
            <Button variant="secondary" size="sm" className="mt-4" onClick={fillDemo}>
              Use demo account
            </Button>
          </aside>
        </div>
      </main>
    </div>
  );
}
