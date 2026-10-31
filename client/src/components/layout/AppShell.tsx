import type { Role } from "@kampus/shared";
import { LogOut } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { errorMessage } from "../../api/client.ts";
import { useCurrentUser, useLogout } from "../../api/hooks.ts";
import { cn } from "../../lib/cn.ts";
import { Avatar, IconButton, Logo, useToast } from "../ui/index.ts";
import { HOME, NAV } from "./nav.ts";
import { loginPath } from "./paths.ts";

function useSignOut(role: Role) {
  const logout = useLogout();
  const navigate = useNavigate();
  const toast = useToast();
  return () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        navigate(loginPath(role), { replace: true });
        toast({ title: "You're logged out", tone: "info" });
      },
      onError: (e) => toast({ title: "Couldn't log out", description: errorMessage(e), tone: "error" }),
    });
}

function Sidebar({ role }: { role: Role }) {
  const user = useCurrentUser();
  const signOut = useSignOut(role);
  return (
    <aside className="bg-kampus-gradient sticky top-0 z-30 hidden h-dvh w-64 shrink-0 flex-col px-4 py-6 text-white lg:flex">
      <Link to={HOME[role]} className="focus-on-dark mb-8 px-2">
        <Logo onDark />
        <span className="sr-only">, go to home</span>
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {NAV[role].map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "focus-on-dark flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition",
                isActive ? "bg-white text-kampus-navy shadow-sm" : "text-white/85 hover:bg-white/10 hover:text-white",
              )
            }
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
        <Avatar firstName={user.firstName} lastName={user.lastName} size="md" className="bg-white/20" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-kampus-sky">{role === "staff" ? (user.staffTitle ?? "Staff") : (user.cohort?.name ?? "Student")}</p>
        </div>
        <IconButton label="Log out" icon={<LogOut />} variant="onDark" size="sm" onClick={signOut} />
      </div>
    </aside>
  );
}

function MobileTopBar({ role }: { role: Role }) {
  const user = useCurrentUser();
  const signOut = useSignOut(role);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
      <Link to={HOME[role]} aria-label="Kampus, go to home">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <IconButton label="Log out" icon={<LogOut />} onClick={signOut} />
        {role === "student" && (
          <Link to="/app/profile" aria-label="Your profile" className="rounded-full p-0.5">
            <Avatar firstName={user.firstName} lastName={user.lastName} size="md" />
          </Link>
        )}
      </div>
    </header>
  );
}

function BottomNav({ role }: { role: Role }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-lg">
        {NAV[role]
          .filter((item) => !item.desktopOnly)
          .map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition",
                    isActive ? "text-kampus-blue" : "text-subtle hover:text-kampus-navy",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", isActive && "bg-kampus-blue-soft")}>
                      <Icon aria-hidden className="size-5" />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
      </ul>
    </nav>
  );
}

/** Layout das áreas privadas: sidebar no desktop (como em 2023), barra em baixo no telemóvel. */
export function AppShell({ role }: { role: Role }) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Ao mudar de página pelo menu, o foco vai para o conteúdo (o leitor de ecrã anuncia a página nova).
  // Se o foco já está dentro do conteúdo (ex.: nota nova com o foco no título), não mexe.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const main = mainRef.current;
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-3 focus:shadow-pop">
        Skip to content
      </a>
      <Sidebar role={role} />
      <MobileTopBar role={role} />
      <main ref={mainRef} id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
      <BottomNav role={role} />
    </div>
  );
}
