import { useCallback, useEffect, useRef, useState } from "react";
import { pickVoice } from "./pickVoice.ts";

const supported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/** Leitura em voz alta com a Web Speech API, com a voz inglesa mais natural que o sistema tiver. */
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
    const voice = pickVoice(window.speechSynthesis.getVoices());
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

  // O Chrome carrega as vozes depois do arranque: pedi-las cedo deixa a lista pronta para o primeiro clique.
  // Ao sair da visita, cala-se.
  useEffect(() => {
    if (!supported) return;
    window.speechSynthesis.getVoices();
    return () => window.speechSynthesis.cancel();
  }, []);

  return { supported, speaking, speak, stop };
}
