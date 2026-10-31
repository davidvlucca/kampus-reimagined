import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { ToastContext, type ToastFn, type ToastTone } from "./toastContext.ts";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

const icons = {
  success: <CheckCircle2 aria-hidden className="size-5 text-success" />,
  error: <XCircle aria-hidden className="size-5 text-danger" />,
  info: <Info aria-hidden className="size-5 text-kampus-blue" />,
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback<ToastFn>(({ title, description, tone = "success" }) => {
    setToasts((list) => [...list.slice(-2), { id: nextId++, title, description, tone }]);
  }, []);
  const remove = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000} label="Notification">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            type={t.tone === "error" ? "foreground" : "background"}
            onOpenChange={(open) => !open && remove(t.id)}
            className={cn(
              "flex items-start gap-3 rounded-2xl border border-line bg-card p-4 shadow-pop data-[state=open]:animate-fade-up",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=closed]:opacity-0 transition",
            )}
          >
            <span className="mt-0.5">{icons[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold text-kampus-navy">{t.title}</ToastPrimitive.Title>
              {t.description && <ToastPrimitive.Description className="mt-0.5 text-sm text-muted">{t.description}</ToastPrimitive.Description>}
            </div>
            <ToastPrimitive.Close aria-label="Dismiss" className="-m-1 grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface hover:text-kampus-navy">
              <X aria-hidden className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        {/* No telemóvel ficam no topo, para não taparem botões nem a barra inferior. */}
        <ToastPrimitive.Viewport className="fixed inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col gap-2 outline-none sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:w-96" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
