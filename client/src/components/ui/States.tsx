import { AlertTriangle, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { Button } from "./Button.tsx";

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      {icon && <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-kampus-blue-soft text-kampus-blue [&_svg]:size-6">{icon}</span>}
      <p className="font-display font-semibold text-kampus-navy">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle aria-hidden className="size-6" />
      </span>
      <p className="font-display font-semibold text-kampus-navy">Couldn't load this</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" icon={<RotateCcw aria-hidden className="size-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-line/70", className)} />;
}

/** Lista de linhas a carregar, com texto para leitores de ecrã. */
export function SkeletonList({ rows = 3, className, label = "Loading" }: { rows?: number; className?: string; label?: string }) {
  return (
    <div role="status" className={cn("flex flex-col gap-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
