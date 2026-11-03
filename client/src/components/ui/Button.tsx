import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonClasses.ts";
import { Spinner } from "./Spinner.tsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * A carregar: ignora cliques e envios (também o Enter num campo do formulário), mas continua
   * focável (aria-disabled), para o foco do teclado não cair no <body> enquanto espera.
   */
  loading?: boolean;
  icon?: ReactNode;
}

/**
 * `disabled` é o nativo (o botão sai da ordem do Tab e perde o foco). Se pode ficar desativado
 * enquanto está focado (ex.: Save depois de gravar), quem o usa decide para onde vai o foco.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, className, children, disabled, type = "button", onClick, ...props },
  ref,
) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Num botão submit, o preventDefault também cancela o envio do formulário.
    if (loading) return event.preventDefault();
    onClick?.(event);
  };
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      onClick={handleClick}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
});
