import { useEffect, useState } from "react";

const FLAP_MS = 140;

/** Abre e fecha a boca do guia enquanto `active` (o texto ainda se está a escrever). */
export function useMouthFlap(active: boolean): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setOpen((o) => !o), FLAP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  return active && open;
}
