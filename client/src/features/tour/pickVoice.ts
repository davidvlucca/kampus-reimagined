/** O que interessa de uma SpeechSynthesisVoice para escolher (facilita os testes). */
export type VoiceInfo = { name: string; lang: string; localService: boolean };

// Vozes de efeitos do macOS e as antigas de 1980: com "en-US" aparecem primeiro na lista
// e soam a robô ou a filme de terror.
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|princess|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy)\b/i;
// Vozes neurais ou melhoradas, as que soam a pessoa.
const NATURAL = /natural|neural|enhanced|premium|siri|google/i;
// Boas vozes clássicas por plataforma (macOS, Windows).
const GOOD = /\b(samantha|ava|allison|susan|zoe|nicky|daniel|karen|moira|tessa|aria|jenny|guy|zira|david)\b/i;

// Vozes de homem pelo nome (macOS e iOS, Windows, Edge, "Google UK English Male"): a API não diz o género.
const MALE = /\b(male|daniel|alex|aaron|arthur|gordon|oliver|evan|nathan|tom|rishi|david|mark|george|ryan|james|guy|andrew|brian|christopher|eric|roger|steffan|thomas|william|liam|connor)\b/i;

function score(v: VoiceInfo, male: boolean): number {
  // Primeiro o género pedido; a qualidade só desempata dentro dele.
  let s = MALE.test(v.name) === male ? 100 : 0;
  if (v.lang === "en-US") s += 4;
  else if (v.lang === "en-GB") s += 3;
  else if (v.lang.startsWith("en")) s += 2;
  if (NATURAL.test(v.name)) s += 8;
  if (GOOD.test(v.name)) s += 5;
  return s;
}

/**
 * A voz inglesa mais natural disponível, ou nenhuma (o browser usa a sua por defeito). Com `male`,
 * uma de homem; sem ele, uma que não seja de homem (no Windows a primeira boa era o "David").
 * shortcut: sem nenhuma voz do género pedido (Android: as vozes não têm nome de pessoa), fica a melhor
 * que houver; para garantir a diferença aí, baixar o `pitch` da fala.
 */
export function pickVoice<T extends VoiceInfo>(voices: readonly T[], male = false): T | undefined {
  let best: T | undefined;
  let bestScore = -1;
  for (const v of voices) {
    if (!v.lang.toLowerCase().startsWith("en") || NOVELTY.test(v.name)) continue;
    const s = score(v, male);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}
