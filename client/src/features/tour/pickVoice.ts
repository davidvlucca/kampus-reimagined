/** O que interessa de uma SpeechSynthesisVoice para escolher (facilita os testes). */
export type VoiceInfo = { name: string; lang: string; localService: boolean };

// Vozes de efeitos do macOS e as antigas de 1980: com "en-US" aparecem primeiro na lista
// e soam a robô ou a filme de terror.
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|princess|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy)\b/i;
// Vozes neurais ou melhoradas, as que soam a pessoa.
const NATURAL = /natural|neural|enhanced|premium|siri|google/i;
// Boas vozes clássicas por plataforma (macOS, Windows).
const GOOD = /\b(samantha|ava|allison|susan|zoe|nicky|daniel|karen|moira|tessa|aria|jenny|guy|zira|david)\b/i;

function score(v: VoiceInfo): number {
  let s = 0;
  if (v.lang === "en-US") s += 4;
  else if (v.lang === "en-GB") s += 3;
  else if (v.lang.startsWith("en")) s += 2;
  if (NATURAL.test(v.name)) s += 8;
  if (GOOD.test(v.name)) s += 5;
  return s;
}

/** A voz inglesa mais natural disponível, ou nenhuma (o browser usa a sua por defeito). */
export function pickVoice<T extends VoiceInfo>(voices: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestScore = -1;
  for (const v of voices) {
    if (!v.lang.toLowerCase().startsWith("en") || NOVELTY.test(v.name)) continue;
    const s = score(v);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}
