import { cn } from "../../lib/cn.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "light";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-kampus-gradient text-white shadow-sm hover:brightness-110 active:brightness-95",
  secondary: "bg-card text-kampus-navy border border-line-strong hover:bg-kampus-blue-soft hover:border-kampus-blue/40",
  ghost: "text-kampus-navy hover:bg-kampus-blue-soft",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95",
  // Para fundos azuis (Welcome, visita).
  light: "bg-white text-kampus-navy shadow-sm hover:bg-kampus-sky-soft focus-on-dark",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

/** As classes de um botão, para usar também num <Link>. */
export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition select-none",
    "disabled:pointer-events-none disabled:opacity-55",
    variants[variant],
    sizes[size],
    className,
  );
}
