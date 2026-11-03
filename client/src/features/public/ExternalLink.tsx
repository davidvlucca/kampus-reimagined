import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/** Link para fora da app, num separador novo; o leitor de ecrã ouve que abre noutro separador. */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn("rounded font-semibold underline underline-offset-2", className)}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
