import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { useDocumentTitle } from "../../lib/useDocumentTitle.ts";

/** Título da página (o único h1), descrição e ações. */
export function PageHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  useDocumentTitle(typeof title === "string" ? title : undefined);
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
