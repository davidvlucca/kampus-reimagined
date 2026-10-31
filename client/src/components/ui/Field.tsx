import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn.ts";

interface FieldBase {
  label: string;
  /** Esconde o rótulo visualmente (continua para leitores de ecrã). */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string;
}

const control = cn(
  "w-full rounded-xl border bg-card px-3.5 text-[15px] text-text placeholder:text-subtle transition",
  "border-line-strong hover:border-kampus-blue/50 focus:border-kampus-blue focus:outline-none focus:ring-3 focus:ring-kampus-blue/20",
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

export type InputProps = FieldBase & InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, className, wrapperClassName, ...props },
  ref,
) {
  const ids = useFieldIds(error, hint);
  return (
    <FieldShell id={ids.id} label={label} hideLabel={hideLabel} hint={hint} hintId={ids.hintId} error={error} errorId={ids.errorId} className={wrapperClassName}>
      <input
        ref={ref}
        id={ids.id}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(control, "h-11", className)}
        {...props}
      />
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
      <select
        ref={ref}
        id={ids.id}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(
          control,
          "h-11 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23475569'%3E%3Cpath d='M5.5 7.5 10 12l4.5-4.5'/%3E%3C/svg%3E\")] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});
