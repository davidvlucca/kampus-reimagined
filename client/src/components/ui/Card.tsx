import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-card shadow-card", className)} {...props} />;
}

/** Cabeçalho de um cartão: título (h2 por omissão), descrição curta e ação à direita. */
export function CardHeader({
  title,
  description,
  action,
  icon,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-kampus-blue-soft text-kampus-blue [&_svg]:size-5">{icon}</span>}
        <div className="min-w-0">
          <Heading className="text-base font-semibold">{title}</Heading>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
