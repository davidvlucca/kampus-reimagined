import { cn } from "../../lib/cn.ts";
import { initials } from "../../lib/format.ts";

const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" };
// Fundos com texto branco, todos acima de 4.5:1.
const palette = ["bg-kampus-blue", "bg-kampus-indigo", "bg-kampus-navy", "bg-kampus-blue-deep", "bg-kampus-indigo-soft"];

/** Avatar com iniciais. A cor é sempre a mesma para a mesma pessoa. */
export function Avatar({ firstName, lastName, size = "md", className }: { firstName: string; lastName: string; size?: keyof typeof sizes; className?: string }) {
  const key = `${firstName}${lastName}`;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-display font-semibold text-white", sizes[size], palette[hash % palette.length], className)}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
