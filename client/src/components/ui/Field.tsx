import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.ts";

interface FieldBase {
  label: string;
  /** Esconde o rótulo visualmente (continua para leitores de ecrã). */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string;
}

const control = cn(
  // 16px no mínimo: abaixo disso o Safari do iOS amplia a página ao focar o campo.
  "w-full min-w-0 rounded-xl border bg-card px-3.5 text-base text-text placeholder:text-subtle transition",
  // Borda com 3:1 sobre branco (WCAG 1.4.11); outline-hidden e não outline-none: em alto contraste
  // o anel desaparece e só fica o contorno do sistema.
  "border-line-control hover:border-kampus-blue focus:border-kampus-blue focus:outline-hidden focus:ring-3 focus:ring-kampus-blue/20",
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-subtle",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20",
);

function useFieldIds(error?: string, hint?: ReactNode) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return { id, hintId, errorId, describedBy: [errorId, hintId].filter(Boolean).join(" ") || undefined };
}

function FieldShell({ id, label, hideLabel, hint, hintId, error, errorId, children, className }: FieldBase & { id: string; hintId?: string; errorId?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium text-kampus-navy", hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export type InputProps = FieldBase &
  InputHTMLAttributes<HTMLInputElement> & {
    wrapperClassName?: string;
    /** Ícone decorativo à esquerda (ex.: lupa numa pesquisa). Fica por cima do campo e não apanha cliques. */
    leadingIcon?: ReactNode;
  };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, className, wrapperClassName, leadingIcon, ...props },
  ref,
) {
  const ids = useFieldIds(error, hint);
  const input = (
    <input
      ref={ref}
      id={ids.id}
      aria-invalid={error ? true : undefined}
      aria-describedby={ids.describedBy}
      className={cn(control, "h-11", leadingIcon != null && "ps-10", className)}
      {...props}
    />
  );
  return (
    <FieldShell id={ids.id} label={label} hideLabel={hideLabel} hint={hint} hintId={ids.hintId} error={error} errorId={ids.errorId} className={wrapperClassName}>
      {leadingIcon != null ? (
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 grid -translate-y-1/2 text-subtle forced-colors:text-[CanvasText] [&_svg]:size-5">
            {leadingIcon}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
    </FieldShell>
  );
});

export type TextareaProps = FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement> & { wrapperClassName?: string };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hideLabel, hint, error, className, wrapperClassName, ...props },
  ref,
) {
  const ids = useFieldIds(error, hint);
  return (
    <FieldShell id={ids.id} label={label} hideLabel={hideLabel} hint={hint} hintId={ids.hintId} error={error} errorId={ids.errorId} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={ids.id}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(control, "min-h-28 py-3 leading-relaxed", className)}
        {...props}
      />
    </FieldShell>
  );
});

export type SelectProps = FieldBase & SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, hint, error, className, wrapperClassName, children, ...props },
  ref,
) {
  const ids = useFieldIds(error, hint);
  return (
    <FieldShell id={ids.id} label={label} hideLabel={hideLabel} hint={hint} hintId={ids.hintId} error={error} errorId={ids.errorId} className={wrapperClassName}>
      {/* A seta é um ícone por cima (e não um background-image), para não perder o bg-card nem sumir em alto contraste. */}
      <div className="relative">
        <select
          ref={ref}
          id={ids.id}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(control, "h-11 appearance-none pe-10", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-muted forced-colors:text-[CanvasText]" />
      </div>
    </FieldShell>
  );
});
