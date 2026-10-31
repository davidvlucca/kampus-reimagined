import { cn } from "../../lib/cn.ts";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <span aria-hidden className={cn("inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** Ecrã inteiro a carregar (ex.: a confirmar a sessão). */
export function FullPageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center text-kampus-blue">
      <Spinner className="size-8" label={label} />
    </div>
  );
}
