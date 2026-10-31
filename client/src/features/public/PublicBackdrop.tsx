import { cn } from "../../lib/cn.ts";

/** Formas desfocadas por trás do gradiente (só decoração). */
export function PublicBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute -top-24 -left-20 size-72 rounded-full bg-kampus-sky/10 blur-3xl" />
      <div className="absolute -right-24 bottom-[-6rem] size-96 rounded-full bg-kampus-blue/50 blur-3xl" />
      <div className="absolute top-1/3 right-[12%] size-40 rotate-12 rounded-[2.5rem] border border-white/15 bg-white/5 blur-[1px]" />
      <div className="absolute bottom-[18%] left-[8%] size-24 -rotate-12 rounded-[1.75rem] border border-white/10 bg-kampus-sky/10" />
    </div>
  );
}
