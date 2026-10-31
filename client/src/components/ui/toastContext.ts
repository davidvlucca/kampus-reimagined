import { createContext, useContext } from "react";

export type ToastTone = "success" | "error" | "info";
export type ToastFn = (toast: { title: string; description?: string; tone?: ToastTone }) => void;

export const ToastContext = createContext<ToastFn | null>(null);

/** `const toast = useToast(); toast({ title: "Task added" })` */
export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
