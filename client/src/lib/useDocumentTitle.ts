import { useEffect } from "react";

/** O título completo, o mesmo do index.html: é o da página inicial. */
const APP_TITLE = "Kampus Reimagined · Campus onboarding app with a 3D tour";

/** Título do separador: "Tasks · Kampus". Cada página tem o seu (WCAG 2.4.2). */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Kampus` : APP_TITLE;
  }, [title]);
}
