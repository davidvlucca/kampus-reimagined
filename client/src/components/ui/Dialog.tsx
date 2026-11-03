import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { useSubmitLock } from "../../lib/submitLock.ts";
import { Button } from "./Button.tsx";
import { useDialogEscape, useReturnFocus } from "./dialogFocus.ts";

const overlay = "fixed inset-0 z-40 bg-kampus-ink/45 backdrop-blur-[2px] data-[state=open]:animate-fade-up";
// No telemóvel abre como folha em baixo; a partir de 640px fica centrado.
const panel = cn(
  "fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-card shadow-pop data-[state=open]:animate-fade-up focus:outline-none",
  "inset-x-0 bottom-0 rounded-t-3xl",
  "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl",
);

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Botões no fundo do dialog (ex.: Cancel / Save). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Ao abrir, o foco vai para o primeiro campo do formulário (o Radix punha-o no X de fechar,
 * e quem abriu "Add student" tinha de dar Tab antes de escrever). Sem campos, fica o do Radix.
 */
function focusFirstField(event: Event) {
  const content = event.target;
  if (!(content instanceof HTMLElement)) return;
  const field = [...content.querySelectorAll<HTMLElement>("input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])")].find(
    (el) => el.getClientRects().length > 0,
  );
  if (!field) return;
  event.preventDefault();
  field.focus();
}

export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  const returnFocus = useReturnFocus(open);
  useDialogEscape(open, () => onOpenChange(false));
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content
          className={cn(panel, className)}
          onOpenAutoFocus={focusFirstField}
          onCloseAutoFocus={returnFocus}
          // Sem descrição não há aria-describedby (repetir o título só fazia o leitor de ecrã dizê-lo duas vezes).
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-lg font-semibold break-words text-kampus-navy">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="clip-marks mt-1 text-sm break-words text-muted">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-2 grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-kampus-blue-soft hover:text-kampus-navy"
            >
              <X aria-hidden className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  /** Pode ser assíncrona: o botão fica a carregar e o dialog só fecha no fim. */
  onConfirm: () => void | Promise<void>;
}

/** Confirmação de uma ação irreversível (ex.: apagar). O foco começa no "Cancel". */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = "Cancel", tone = "danger", onConfirm }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  // O `busy` só desativa o botão no re-render seguinte: um duplo clique apagava duas vezes
  // (e o segundo dava "not found" logo a seguir ao "deleted").
  const lock = useSubmitLock();
  const returnFocus = useReturnFocus(open);
  useDialogEscape(open, () => !busy && onOpenChange(false));
  const confirm = () =>
    lock(async () => {
      setBusy(true);
      try {
        await onConfirm();
        onOpenChange(false);
      } finally {
        setBusy(false);
      }
    });
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlay} />
        <AlertDialogPrimitive.Content className={cn(panel, "sm:max-w-md")} onCloseAutoFocus={returnFocus}>
          <div className="px-6 pt-6 pb-2">
            <AlertDialogPrimitive.Title className="clip-marks font-display text-lg font-semibold break-words text-kampus-navy">{title}</AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="clip-marks mt-2 text-sm break-words text-muted">{description}</AlertDialogPrimitive.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 px-6 pt-4 pb-6 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" disabled={busy}>
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button variant={tone === "danger" ? "danger" : "primary"} loading={busy} onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
