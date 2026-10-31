import { useCallback, useEffect, useRef, useState } from "react";

const supported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/** Leitura em voz alta com a Web Speech API (voz en-US quando existir). */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  // Só a fala atual pode mudar o estado (o cancel de uma antiga dispara onend mais tarde).
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (!supported) return;
    current.current = null;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === "en-US") ?? voices.find((v) => v.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-US";
    const end = () => {
      if (current.current === utterance) {
        current.current = null;
        setSpeaking(false);
      }
    };
    utterance.onend = end;
    utterance.onerror = end;
    current.current = utterance;
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  // Ao sair da visita, cala-se.
  useEffect(
    () => () => {
      if (supported) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported, speaking, speak, stop };
}
