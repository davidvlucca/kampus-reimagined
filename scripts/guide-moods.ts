// Gera as expressões dos guias da visita a partir das ilustrações base (o sorriso):
//   guide-<id>-talk.svg     boca aberta (alterna com a expressão enquanto o texto se escreve)
//   guide-<id>-wink.svg     a piscar o olho direito
//   guide-<id>-curious.svg  sobrancelha levantada e boca em "o"
// Uso: node scripts/guide-moods.ts  (volta a escrever os ficheiros em client/public/tour/)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GUIDES, type GuideFace, type GuideId } from "../shared/src/tour.ts";

const DIR = "client/public/tour";

interface Face {
  /** A boca da imagem base (uma ou mais linhas seguidas). */
  mouth: RegExp;
  /** Centro da boca e cor do interior. */
  mouthY: number;
  mouthColor: string;
  /** O olho direito da imagem base (é o que pisca). */
  rightEye: RegExp;
  /** O olho fechado, a substituir o direito. */
  closedEye: string;
  /** A sobrancelha direita (é a que levanta). */
  rightBrow: RegExp;
}

const roundEye = /\n\s*<ellipse cx="274" cy="214" rx="8" ry="10" fill="[^"]+"\/>/;
const roundEyeShine = /\n\s*<circle cx="277" cy="210" r="3" fill="#FFFFFF"\/>/;
const closedRound = (color: string) => `<path d="M264 214 Q274 204 284 214" stroke="${color}" stroke-width="6" fill="none" stroke-linecap="round"/>`;

const FACES: Record<GuideId, Face> = {
  "program-manager": {
    mouth: /<path d="M212 262 Q240 296 268 262 Z"[^>]*\/>\s*<path d="M218 263[^>]*\/>/,
    mouthY: 272,
    mouthColor: "#6B2626",
    rightEye: roundEye,
    closedEye: closedRound("#1E1B2E"),
    rightBrow: /<path d="M258 188 Q275 180 292 190"[^>]*\/>/,
  },
  "lead-teacher": {
    mouth: /<path d="M212 270 Q240 292 268 270 Q240 280 212 270 Z"[^>]*\/>/,
    mouthY: 278,
    mouthColor: "#6E2A27",
    rightEye: /<path d="M266 210 Q276 200 286 210"[^>]*\/>/,
    closedEye: `<path d="M264 209 L288 209" stroke="#1E293B" stroke-width="7" fill="none" stroke-linecap="round"/>`,
    rightBrow: /<path d="M258 176 Q276 168 294 178"[^>]*\/>/,
  },
  "teaching-assistant": {
    mouth: /<path d="M206 262 Q240 300 274 262 Z"[^>]*\/>\s*<path d="M212 264[^>]*\/>/,
    mouthY: 274,
    mouthColor: "#7A2E2E",
    rightEye: roundEye,
    closedEye: closedRound("#1E1B2E"),
    rightBrow: /<path d="M260 186 Q276 178 292 186"[^>]*\/>/,
  },
  "career-coach": {
    mouth: /<path d="M216 264 Q240 284 264 264"[^>]*\/>/,
    mouthY: 272,
    mouthColor: "#8A2E2A",
    rightEye: roundEye,
    closedEye: closedRound("#1E293B"),
    rightBrow: /<path d="M258 188 Q274 180 290 188"[^>]*\/>/,
  },
};

function replaceOnce(svg: string, pattern: RegExp, replacement: string, what: string): string {
  if (!pattern.test(svg)) throw new Error(`Not found: ${what}`);
  return svg.replace(pattern, replacement);
}

function variant(base: string, face: Face, mood: Exclude<GuideFace, "smile">, id: GuideId): string {
  const { mouthY: y, mouthColor: c } = face;
  switch (mood) {
    case "talk":
      return replaceOnce(
        base,
        face.mouth,
        `<ellipse cx="240" cy="${y}" rx="17" ry="13" fill="${c}"/>\n  <ellipse cx="240" cy="${y + 6}" rx="10" ry="5" fill="#E58A8A"/>`,
        `${id} mouth`,
      );
    case "wink": {
      const eye = face.rightEye === roundEye ? `\n  ${face.closedEye}` : face.closedEye;
      let svg = replaceOnce(base, face.rightEye, eye, `${id} right eye`);
      if (face.rightEye === roundEye) svg = replaceOnce(svg, roundEyeShine, "", `${id} eye shine`);
      return svg;
    }
    case "curious": {
      const brow = base.match(face.rightBrow)?.[0];
      if (!brow) throw new Error(`Not found: ${id} right brow`);
      const raised = brow.replace("<path ", '<path transform="translate(0 -18) rotate(-14 276 182)" ');
      const svg = replaceOnce(base, face.rightBrow, raised, `${id} right brow`);
      return replaceOnce(svg, face.mouth, `<ellipse cx="246" cy="${y}" rx="8" ry="9" fill="${c}"/>`, `${id} mouth`);
    }
  }
}

/** Todas as variantes: caminho do ficheiro → SVG. */
export function renderMoods(): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of Object.keys(GUIDES) as GuideId[]) {
    const base = readFileSync(`${DIR}/guide-${id}.svg`, "utf8");
    for (const mood of ["talk", "wink", "curious"] as const) {
      const svg = variant(base, FACES[id], mood, id).replace(/(<!-- [^>]+?)( -->)/, `$1 (expressão: ${mood})$2`);
      out.set(`${DIR}/guide-${id}-${mood}.svg`, svg);
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, svg] of renderMoods()) writeFileSync(path, svg);
  console.log("Guide moods written to", DIR);
}
