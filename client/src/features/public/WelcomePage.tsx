import { ArrowRight, BriefcaseBusiness, GraduationCap, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { useMe } from "../../api/hooks.ts";
import { loginPath, homePathFor } from "../../components/layout/paths.ts";
import { Button, buttonClasses, Logo } from "../../components/ui/index.ts";
import { cn } from "../../lib/cn.ts";
import { PublicBackdrop } from "./PublicBackdrop.tsx";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";
import { useDemoLogin } from "./useDemoLogin.ts";

const choices: { to: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    to: loginPath("student"),
    label: "Student",
    description: "Take the campus tour, plan your week and find the right person to ask.",
    icon: GraduationCap,
  },
  {
    to: loginPath("staff"),
    label: "Staff",
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

      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-10">
        <h1 className="animate-fade-up font-display text-5xl font-semibold tracking-tight text-white sm:text-7xl">Welcome!</h1>
        <p className="mt-3 text-lg text-white sm:text-xl">Your first days on campus, sorted.</p>

        <nav aria-label="Choose your profile" className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          {choices.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "group focus-on-dark flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-white p-6 text-left shadow-pop transition",
                "hover:-translate-y-0.5 hover:bg-kampus-sky-soft",
              )}
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-kampus-blue-soft text-kampus-blue">
                <Icon aria-hidden className="size-6" />
              </span>
              <span className="flex w-full items-center justify-between gap-2 font-display text-xl font-semibold tracking-wide text-kampus-navy uppercase">
                {label}
                <ArrowRight aria-hidden className="size-5 text-kampus-blue transition group-hover:translate-x-0.5" />
              </span>
              <span className="text-sm text-muted">{description}</span>
            </Link>
          ))}
        </nav>

        {user ? (
          <Link to={homePathFor(user)} className={buttonClasses({ variant: "light", size: "lg", className: "mt-8" })}>
            Continue as {user.firstName}
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        ) : (
          <section aria-labelledby="demo-title" className="mt-8 flex flex-col items-center gap-3">
            <h2 id="demo-title" className="text-sm font-medium text-white">
              Just looking around? Open the demo in one click.
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {(["student", "staff"] as const).map((portal) => (
                <Button
                  key={portal}
                  variant="light"
                  size="sm"
                  loading={demo.pendingPortal === portal}
                  disabled={demo.isPending}
                  onClick={() => demo.start(portal)}
                >
                  Try as {portal}
                </Button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="relative px-5 pb-6 text-center text-xs text-white/80 sm:px-10">
        A portfolio remake of Kampus, a team project from Ironhack (2023). All data is fictional.
      </footer>
    </div>
  );
}
