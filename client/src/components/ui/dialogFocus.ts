import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// ---------- Esc fecha primeiro o dialog ----------

// Um toast que aparece com um dialog aberto (ex.: "Couldn't save") fica por cima dele nas
// camadas do Radix e comia o primeiro Esc. O toast pergunta aqui se há um dialog aberto e,
// se houver, fecha-o em vez de se fechar a si.
const openDialogs: (() => void)[] = [];

/** Fecha o dialog aberto mais recente. `false` se não houver nenhum. */
export function closeTopDialog(): boolean {
  const close = openDialogs.at(-1);
  if (!close) return false;
  close();
  return true;
}

/** Regista o dialog enquanto está aberto (`close` é o mesmo que o Esc faria). */
export function useDialogEscape(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const entry = () => closeRef.current();
    openDialogs.push(entry);
    return () => {
      const i = openDialogs.lastIndexOf(entry);
      if (i >= 0) openDialogs.splice(i, 1);
    };
  }, [open]);
}

// ---------- Foco de volta ao fechar ----------

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusable(el: Element | null): HTMLElement | null {
  if (!(el instanceof HTMLElement) || !el.isConnected) return null;
  const target = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE);
  // Escondido (ex.: a tabela de alunos no telemóvel) não conta.
  return target && target.getClientRects().length > 0 ? target : null;
}

interface Opener {
  el: HTMLElement;
  next: Element | null;
  prev: Element | null;
}

/**
 * Os nossos dialogs abrem sem <Dialog.Trigger> (o estado vem da página), e o Radix, sem
 * trigger, mandava o foco para o <body> ao fechar. Guarda quem tinha o foco ao abrir e
 * devolve-lho; se já não existir (ex.: a tarefa apagada), vai para a linha seguinte ou a
 * anterior da mesma lista e, em último caso, para o conteúdo da página.
 * Devolve o handler para `onCloseAutoFocus`.
 */
export function useReturnFocus(open: boolean) {
  const opener = useRef<Opener | null>(null);
  // Layout effect: corre antes de o Radix mover o foco para dentro do dialog.
  useLayoutEffect(() => {
    if (!open) return;
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body) {
      opener.current = null;
      return;
    }
    const row = el.closest("li, tr");
    opener.current = { el, next: row?.nextElementSibling ?? null, prev: row?.previousElementSibling ?? null };
  }, [open]);

  return useCallback((event: Event) => {
    event.preventDefault();
    const saved = opener.current;
    const target =
      (saved && (focusable(saved.el) ?? focusable(saved.next) ?? focusable(saved.prev))) ?? document.getElementById("main");
    target?.focus();
  }, []);
}
