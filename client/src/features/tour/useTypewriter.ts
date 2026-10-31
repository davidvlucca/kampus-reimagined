import { useCallback, useEffect, useState } from "react";

const CHAR_MS = 28;

/**
 * Efeito de máquina de escrever. `key` identifica o texto (a paragem): ao mudar,
 * recomeça do zero. Com `instant` (reduced motion) o texto aparece logo inteiro.
 */
export function useTypewriter(text: string, key: number, instant: boolean) {
  const [progress, setProgress] = useState({ key, chars: 0 });
  const chars = instant ? text.length : progress.key === key ? Math.min(progress.chars, text.length) : 0;
  const done = chars >= text.length;

  useEffect(() => {
    if (instant || done) return;
    const id = window.setInterval(() => {
      setProgress((p) => ({ key, chars: (p.key === key ? p.chars : 0) + 1 }));
    }, CHAR_MS);
    return () => window.clearInterval(id);
  }, [key, instant, done]);

  const finish = useCallback(() => setProgress({ key, chars: text.length }), [key, text.length]);

  return { shown: text.slice(0, chars), done, finish };
}
