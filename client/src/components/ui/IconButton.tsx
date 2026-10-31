import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Obrigatório: vira o aria-label e a dica ao passar o rato. */
  label: string;
  icon: ReactNode;
  variant?: "ghost" | "secondary" | "danger" | "onDark";
  size?: "sm" | "md";
}

const variants = {
  ghost: "text-muted hover:bg-kampus-blue-soft hover:text-kampus-navy",
  secondary: "border border-line-strong bg-card text-kampus-navy hover:bg-kampus-blue-soft",
  danger: "text-muted hover:bg-danger-soft hover:text-danger",
  onDark: "text-white/85 hover:bg-white/10 hover:text-white focus-on-dark",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", size = "md", className, type = "button", title, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 [&_svg]:size-5",
        size === "md" ? "size-11" : "size-9",
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
