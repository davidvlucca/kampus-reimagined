import type { Portal } from "@kampus/shared";
import { ArrowRight, BriefcaseBusiness, GraduationCap, LayoutDashboard, MapPinned, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { useMe } from "../../api/hooks.ts";
import { loginPath, homePathFor } from "../../components/layout/paths.ts";
import { buttonClasses, Logo, Spinner } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { ExternalLink } from "./ExternalLink.tsx";
import { AUTHOR_URL, REPO_URL } from "./links.ts";
import { PublicBackdrop } from "./PublicBackdrop.tsx";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";
import { useDemoLogin } from "./useDemoLogin.ts";

// A demo é a ação principal: quem chega do portfólio quer ver a app, não um login vazio.
const demos: { portal: Portal; label: string; hint: string; icon: LucideIcon }[] = [
  { portal: "student", label: "Explore as a student", hint: "3D campus tour, tasks and notes", icon: MapPinned },
  { portal: "staff", label: "Explore as staff", hint: "Dashboards and cohort tasks", icon: LayoutDashboard },
];

const choices: { to: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    to: loginPath("student"),
    label: "Log in as a student",
    description: "Take the campus tour, plan your week and find the right person to ask.",
    icon: GraduationCap,
  },
  {
    to: loginPath("staff"),
    label: "Log in as staff",
    description: "Add students and see how they're settling in.",
    icon: BriefcaseBusiness,
  },
];

export function WelcomePage() {
  useDocumentTitle(undefined);
  const me = useMe();
  const user = me.data;
  const demo = useDemoLogin();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-kampus-gradient text-white">
      <PublicBackdrop />

      <header className="relative px-5 pt-6 sm:px-10 sm:pt-8">
        <Logo onDark />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 text-center sm:px-10">
        {/* No telemóvel fica só o essencial, numa linha: a visita 3D já está no botão da demo. */}
        <p className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white sm:px-4 sm:text-sm">
          <span>Portfolio project</span>
          <span aria-hidden>·</span>
          <span>React, TypeScript, Node</span>
          <span aria-hidden className="hidden sm:inline">
            ·
          </span>
          <span className="hidden sm:inline">3D campus tour</span>
        </p>
        <h1 className="mt-5 animate-fade-up font-display text-5xl font-semibold tracking-tight text-white sm:text-7xl">Welcome!</h1>
        <p className="mt-3 text-lg text-white sm:text-xl">Your first days on campus, sorted.</p>

        {user ? (
          <Link to={homePathFor(user)} className={buttonClasses({ variant: "light", size: "lg", className: "mt-8" })}>
            Continue as {user.firstName}
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        ) : (
          <section aria-labelledby="demo-title" className="mt-9 w-full max-w-3xl">
            <h2 id="demo-title" className="font-display text-lg font-semibold text-white">
              Try the live demo, no sign-up
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {demos.map(({ portal, label, hint, icon: Icon }) => (
                <button
                  key={portal}
                  type="button"
                  aria-busy={demo.pendingPortal === portal || undefined}
                  disabled={demo.isPending}
                  onClick={() => demo.start(portal)}
                  className={cn(
                    "group focus-on-dark flex items-center gap-4 rounded-[var(--radius-card)] bg-white p-4 text-left shadow-pop transition sm:p-5",
                    "hover:-translate-y-0.5 hover:bg-kampus-sky-soft disabled:pointer-events-none disabled:opacity-70",
                    "forced-colors:border forced-colors:border-[ButtonText]",
                  )}
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-kampus-gradient text-white">
                    {demo.pendingPortal === portal ? <Spinner className="size-5" /> : <Icon aria-hidden className="size-6" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-display text-lg font-semibold text-kampus-navy">
                      {label}
                    </span>
                    <span className="text-sm text-muted">
                      {hint}
                    </span>
                  </span>
                  <ArrowRight aria-hidden className="size-5 shrink-0 text-kampus-blue transition group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </section>
        )}

        <nav aria-labelledby="login-title" className="mt-10 w-full max-w-3xl">
          <h2 id="login-title" className="text-sm font-medium text-white">
            {user ? "Or log in with another account" : "Have an account? Log in"}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {choices.map(({ to, label, description, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group focus-on-dark flex items-start gap-3 rounded-[var(--radius-card)] border border-white/25 bg-white/[0.08] p-4 text-left transition",
                  "hover:border-white/45 hover:bg-white/[0.14]",
                )}
              >
                <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-kampus-sky" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2 font-semibold text-white">
                    {label}
                    <ArrowRight aria-hidden className="size-4 shrink-0 transition group-hover:translate-x-0.5" />
                  </span>
                  <span className="text-sm text-white">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </main>

      <footer className="relative px-5 pb-6 text-center text-sm text-white sm:px-10">
        <p className="mx-auto max-w-3xl">
          A portfolio project by <ExternalLink href={AUTHOR_URL} className="focus-on-dark">David Lucca</ExternalLink>, remade from a team project at Ironhack (2023, 1st place). All data is fictional.
        </p>
        <p className="mt-1">
          <ExternalLink href={REPO_URL} className="focus-on-dark">
            Code on GitHub
          </ExternalLink>
        </p>
      </footer>
    </div>
  );
}
