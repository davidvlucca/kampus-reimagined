import type { Role } from "@kampus/shared";
import { LogOut } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
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
    // A coluna estica com a página (fundo no tom final do gradiente); o painel com o gradiente fica preso ao topo.
    <div className="hidden w-64 shrink-0 bg-kampus-indigo lg:block">
    {/* Um <div> e não <aside>: o marco é o <nav> lá dentro (um "complementary" à volta do menu principal confundia). */}
    <div className="bg-kampus-gradient sticky top-0 z-30 flex h-dvh flex-col px-4 py-6 text-white">
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
                "focus-on-dark flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium transition",
                isActive
                  ? // Alto contraste: os fundos desaparecem, por isso o ativo usa as cores de seleção do sistema.
                    "bg-white text-kampus-navy shadow-sm forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none"
                  : "text-white/85 hover:bg-white/10 hover:text-white",
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
          {/* Duas linhas antes de cortar: "Program Manager" ou "Web Dev Oct 2026" não cabiam numa. */}
          <p className="line-clamp-2 text-sm font-semibold break-words">
            {user.firstName} {user.lastName}
          </p>
          <p className="line-clamp-2 text-xs break-words text-kampus-sky">{role === "staff" ? (user.staffTitle ?? "Staff") : (user.cohort?.name ?? "Student")}</p>
        </div>
        <IconButton label="Log out" icon={<LogOut />} variant="onDark" size="sm" onClick={signOut} />
      </div>
    </div>
    </div>
  );
}

function MobileTopBar({ role, barRef }: { role: Role; barRef: RefObject<HTMLElement | null> }) {
  const user = useCurrentUser();
  const signOut = useSignOut(role);
  return (
    // Altura mínima e não fixa, com quebra de linha: com o texto a 200% os botões passam para
    // baixo do logótipo em vez de saírem do ecrã.
    <header ref={barRef} className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-x-2 border-b border-line bg-surface/90 px-4 py-2 backdrop-blur lg:hidden">
      <Link to={HOME[role]} aria-label="Kampus, go to home" className="min-w-0">
        <Logo />
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Log out" icon={<LogOut />} onClick={signOut} />
        {role === "student" && (
          // Nome pelo texto (e não aria-label): as iniciais visíveis não fazem parte do nome (WCAG 2.5.3).
          <Link to="/app/profile" className="rounded-full p-0.5">
            <Avatar firstName={user.firstName} lastName={user.lastName} size="md" />
            <span className="sr-only">Your profile</span>
          </Link>
        )}
      </div>
    </header>
  );
}

function BottomNav({ role, barRef }: { role: Role; barRef: RefObject<HTMLElement | null> }) {
  const { pathname } = useLocation();
  const listRef = useRef<HTMLUListElement>(null);
  // Com a lista a deslizar (texto grande), a página atual fica sempre à vista.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav ref={barRef} aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {/* Uma linha só: com o texto a 200% num ecrã de 320px os itens não cabem e a lista desliza
          na horizontal (antes os últimos ficavam fora do ecrã, inalcançáveis). */}
      <ul ref={listRef} className="mx-auto flex max-w-lg overflow-x-auto overscroll-x-contain">
        {NAV[role]
          .filter((item) => !item.desktopOnly)
          .map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="min-w-max flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-1.5 text-[0.6875rem] font-semibold transition",
                    isActive ? "text-kampus-blue" : "text-subtle hover:text-kampus-navy",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "grid h-7 w-12 place-items-center rounded-full transition",
                        isActive && "bg-kampus-blue-soft forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none",
                      )}
                    >
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

/** Foca o h1 da página (o leitor de ecrã anuncia o título). O tabindex só dura até perder o foco. */
function focusHeading(main: HTMLElement): boolean {
  // O primeiro que se vê: as notas no telemóvel têm um h1 escondido (max-lg:hidden) e outro sr-only.
  const heading = [...main.querySelectorAll<HTMLElement>("h1")].find((h) => h.getClientRects().length > 0);
  if (!heading) return false;
  if (!heading.hasAttribute("tabindex")) {
    heading.tabIndex = -1;
    heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
  }
  heading.focus({ preventScroll: true });
  return true;
}

/** O foco ficou fora do conteúdo, no <body>, ou num elemento que deixou de se ver (ex.: a lista de notas no telemóvel). */
function focusIsLost(main: HTMLElement) {
  const el = document.activeElement;
  return !el || el === document.body || !main.contains(el) || el.getClientRects().length === 0;
}

/**
 * A barra do topo (sticky) e a de baixo (fixa) do telemóvel tapavam o elemento focado (WCAG 2.4.11).
 * As alturas reais vão para o scroll-padding do <html> (ver index.css): com o texto a 200% a barra
 * do topo passa a ter duas linhas, e um valor fixo não chegava.
 */
function useBarInsets(top: RefObject<HTMLElement | null>, bottom: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--shell-top", `${top.current?.offsetHeight ?? 0}px`);
      root.style.setProperty("--shell-bottom", `${bottom.current?.offsetHeight ?? 0}px`);
    };
    const observer = new ResizeObserver(update);
    for (const el of [top.current, bottom.current]) if (el) observer.observe(el);
    update();
    return () => {
      observer.disconnect();
      root.style.removeProperty("--shell-top");
      root.style.removeProperty("--shell-bottom");
    };
  }, [top, bottom]);
}

/** Layout das áreas privadas: sidebar no desktop (como em 2023), barra em baixo no telemóvel. */
export function AppShell({ role }: { role: Role }) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const topBarRef = useRef<HTMLElement>(null);
  const bottomNavRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  useBarInsets(topBarRef, bottomNavRef);

  // Ao mudar de página pelo menu, o foco vai para o título da página nova.
  // Se o foco já está num elemento visível do conteúdo (ex.: nota nova com o foco no título), não mexe.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const main = mainRef.current;
    if (!main || !focusIsLost(main)) return;
    if (focusHeading(main)) return;
    // Página ainda sem h1 (a carregar): espera um pouco por ele; se não vier, fica o <main>.
    main.focus({ preventScroll: true });
    const observer = new MutationObserver(() => {
      if (document.activeElement !== main || focusHeading(main)) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    const timer = window.setTimeout(() => observer.disconnect(), 3000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <div data-app-shell className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-3 focus:shadow-pop">
        Skip to content
      </a>
      <Sidebar role={role} />
      <MobileTopBar role={role} barRef={topBarRef} />
      {/* Nome para quando o foco cai aqui (página ainda sem título). */}
      <main ref={mainRef} id="main" tabIndex={-1} aria-label="Content" className="min-w-0 flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
      <BottomNav role={role} barRef={bottomNavRef} />
    </div>
  );
}
