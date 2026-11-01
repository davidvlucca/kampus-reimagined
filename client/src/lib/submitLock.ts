import { useState } from "react";

/**
 * Trava síncrona contra o duplo envio. O `isPending` de uma mutation só chega no re-render
 * seguinte e um duplo clique rápido passava antes dele (tarefas e notas duplicadas, dois
 * toasts contraditórios). `run(task)` ignora a chamada enquanto a anterior não acabar.
 */
export function createSubmitLock() {
  let busy = false;
  return async function run(task: () => Promise<unknown>): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await task();
    } finally {
      busy = false;
    }
  };
}

/** Uma trava por formulário (dura enquanto o componente estiver montado). */
export function useSubmitLock() {
  return useState(createSubmitLock)[0];
}
