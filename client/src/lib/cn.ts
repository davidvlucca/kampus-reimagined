import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge resolve conflitos (a última classe ganha): <Button className="text-danger">
// passa por cima da cor da variante. Precisa de conhecer os nossos tokens.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "kampus-ink", "kampus-navy", "kampus-indigo", "kampus-blue", "kampus-blue-deep", "kampus-indigo-soft",
        "kampus-sky", "kampus-sky-soft", "kampus-blue-soft", "surface", "card", "line", "line-strong", "text",
        "muted", "subtle", "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft",
      ],
      font: ["display", "pixel"],
      shadow: ["card", "pop"],
      animate: ["fade-up"],
    },
    classGroups: { "bg-image": ["bg-kampus-gradient"] },
  },
});

/** Junta classes, ignorando valores falsos e resolvendo conflitos do Tailwind. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
