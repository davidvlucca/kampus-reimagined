import { useEffect } from "react";

/** Título do separador: "Tasks · Kampus". Cada página tem o seu (WCAG 2.4.2). */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Kampus` : "Kampus";
  }, [title]);
}
