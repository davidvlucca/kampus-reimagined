import { Check } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  hideLabel?: boolean;
}

/** Checkbox nativo (teclado e leitores de ecrã de borla), com aspeto próprio. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hideLabel, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("inline-flex cursor-pointer items-center gap-3", className)}>
      <span className="relative grid size-6 shrink-0 place-items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            "peer size-6 cursor-pointer appearance-none rounded-lg border-2 border-line-control bg-card transition",
            "hover:border-kampus-blue checked:border-kampus-blue checked:bg-kampus-blue",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          {...props}
        />
        <Check aria-hidden strokeWidth={3} className="pointer-events-none absolute size-4 text-white opacity-0 transition peer-checked:opacity-100" />
      </span>
      {/* min-w-0: sem ele, um título comprido sem espaços empurrava a linha para fora do ecrã. */}
      <span className={cn("min-w-0", hideLabel && "sr-only")}>{label}</span>
    </label>
  );
});
