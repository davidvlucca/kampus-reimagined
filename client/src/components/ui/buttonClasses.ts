import { cn } from "../../lib/cn.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "light";
export type ButtonSize = "sm" | "md" | "lg";

// Os botões cheios (primary, danger) ficam lisos e cinzentos quando desativados: com opacidade,
// o gradiente ficava baço e parecia um botão estragado. Os outros só esmaecem.
const solidDisabled = "disabled:bg-none disabled:bg-line disabled:text-muted disabled:shadow-none";
const softDisabled = "disabled:opacity-55";

const variants: Record<ButtonVariant, string> = {
  primary: `bg-kampus-gradient text-white shadow-sm hover:brightness-110 active:brightness-95 ${solidDisabled}`,
  secondary: `bg-card text-kampus-navy border border-line-strong hover:bg-kampus-blue-soft hover:border-kampus-blue/40 ${softDisabled}`,
  ghost: `text-kampus-navy hover:bg-kampus-blue-soft ${softDisabled}`,
  danger: `bg-danger text-white hover:brightness-110 active:brightness-95 ${solidDisabled}`,
  // Para fundos azuis (Welcome, visita).
  light: `bg-white text-kampus-navy shadow-sm hover:bg-kampus-sky-soft focus-on-dark ${softDisabled}`,
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm gap-1.5 rounded-lg",
  md: "min-h-11 px-4 py-2 text-sm gap-2 rounded-xl",
  lg: "min-h-12 px-6 py-2 text-base gap-2 rounded-xl",
};

/** As classes de um botão, para usar também num <Link>. */
export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    // Sem whitespace-nowrap: com o texto a 200% num ecrã estreito o rótulo parte em duas linhas em vez de sair do ecrã.
    "inline-flex max-w-full shrink-0 items-center justify-center text-center font-semibold transition select-none",
    "disabled:pointer-events-none",
    // A carregar (aria-disabled, ver Button): mantém o aspeto, só o cursor muda.
    "aria-busy:cursor-progress",
    // Alto contraste (Windows): o fundo desaparece e, sem borda, o botão parecia texto solto.
    "forced-colors:border forced-colors:border-[ButtonText] forced-colors:disabled:border-[GrayText]",
    variants[variant],
    sizes[size],
    className,
  );
}
