import type { GuideFace, TourStop } from "@kampus/shared";
import { Check } from "lucide-react";
import { useId, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/cn.ts";
import { GuidePortrait } from "./GuidePortrait.tsx";
import { TOTAL } from "./useTourNavigation.ts";

interface Props {
  cardRef: RefObject<HTMLElement | null>;
  stop: TourStop;
  face: GuideFace;
  /** "Nome · Cargo" (ou só o cargo, enquanto os contactos carregam). */
  guideLabel: string;
  guideName: string;
  /** A fala inteira (a resposta, se se fez uma pergunta). */
  line: string;
  /** A parte da fala já escrita. */
  shown: string;
  done: boolean;
  finish: () => void;
  question: string | null;
  asked: ReadonlySet<string>;
  onAsk: (id: string) => void;
  showQuestions: boolean;
  speechSupported: boolean;
  audioHintId: string;
  /** A última paragem: o selo de visita feita. */
  finale: boolean;
  /** A fila de botões (Back, áudio, Next). */
  controls: ReactNode;
}

// O guia grande do desktop tem a altura que cabe no ecrã; o cartão começa onde acaba a cara
// (a imagem é quadrada e a cara fica a meio), para nunca a tapar entre 1280 e 1920 px.
const portraitSize = "lg:[--portrait:min(58dvh,520px)]";

/** O guia e a caixa de diálogo: a fala, as perguntas e os controlos. */
export function GuideDialog({
  cardRef,
  stop,
  face,
  guideLabel,
  guideName,
  line,
  shown,
  done,
  finish,
  question,
  asked,
  onAsk,
  showQuestions,
  speechSupported,
  audioHintId,
  finale,
  controls,
}: Props) {
  const askId = useId();
  return (
    <>
      <GuidePortrait
        guide={stop.guide}
        face={face}
        className={cn(portraitSize, "absolute -bottom-8 left-[calc(var(--portrait)*-0.08)] hidden h-(--portrait) lg:grid")}
        imgClassName="h-full w-auto"
      />
      <section
        ref={cardRef}
        tabIndex={-1}
        aria-label="Guide"
        className={cn(
          "pointer-events-auto relative rounded-[var(--radius-card)] bg-kampus-navy/95 p-5 shadow-pop ring-1 ring-white/15",
          "short:min-h-0 short:overflow-y-auto short:p-3.5",
          portraitSize,
          "lg:ml-[calc(var(--portrait)*0.64)] lg:max-w-[52rem] lg:p-7 lg:backdrop-blur",
        )}
      >
        {finale && <FinaleStamp />}
        {/* No telemóvel o guia sai por cima do cartão (deitado não há altura: fica pequeno, dentro) */}
        <div className={cn("flex items-end gap-3 short:items-center", finale && "pr-16 lg:pr-24")}>
          <GuidePortrait
            guide={stop.guide}
            face={face}
            className={cn(
              "-mt-14 size-22 shrink-0 overflow-hidden rounded-full bg-kampus-sky-soft shadow-pop ring-2 ring-kampus-sky",
              "md:-mt-16 md:size-24 short:mt-0 short:size-9 short:shadow-none lg:hidden",
            )}
            imgClassName="size-full object-cover object-top"
          />
          <p className="rounded-lg bg-kampus-sky px-3 py-1 text-sm font-semibold text-kampus-ink">{guideLabel}</p>
        </div>

        {/* Clicar no texto mostra-o todo (no teclado: Enter) */}
        <div onClick={finish} className={cn("mt-4 grid text-base leading-relaxed short:mt-2 short:text-sm md:text-lg", !done && "cursor-pointer")}>
          {/* As versões invisíveis reservam o espaço da fala mais longa da paragem (com as
              respostas), para a caixa não mudar de altura ao fazer uma pergunta. No telemóvel
              só a da fala atual: lá a caixa fica do tamanho do texto (senão sobrava um vazio). */}
          {[stop.text, ...stop.questions.map((q) => q.answer)].map((text, i) => (
            <p key={i} aria-hidden className={cn("invisible [grid-area:1/1]", text !== line && "max-lg:hidden")}>
              {text}
            </p>
          ))}
          <p aria-hidden className="[grid-area:1/1]">
            {shown}
          </p>
        </div>
        <p aria-hidden className={cn("mt-2 hidden text-xs text-white/75 lg:block", done && "invisible")}>
          Press Enter or click the text to show it all
        </p>

        {/* Perguntas ao guia: aparecem quando a fala acaba (o espaço fica reservado para nada saltar) */}
        {stop.questions.length > 0 && (
          <div className={cn("mt-4 short:mt-2", !showQuestions && "invisible")}>
            <p id={askId} className="text-xs font-semibold tracking-wide text-white/80 uppercase short:sr-only">
              Ask {guideName}
            </p>
            <div role="group" aria-labelledby={askId} className="mt-2 flex flex-wrap gap-2 short:mt-0">
              {stop.questions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  aria-pressed={question === q.id}
                  onClick={() => onAsk(q.id)}
                  className={cn(
                    "focus-on-dark inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm font-medium ring-1 transition",
                    "short:min-h-9 short:text-xs",
                    question === q.id ? "bg-white text-kampus-navy ring-white" : "bg-white/10 text-white ring-white/25 hover:bg-white/20",
                  )}
                >
                  {q.label}
                  {asked.has(q.id) && question !== q.id && (
                    <>
                      <Check aria-hidden className="size-4 shrink-0 text-kampus-sky" />
                      <span className="sr-only">(asked)</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {!speechSupported && (
          <p id={audioHintId} className="mt-2 text-xs text-white/75">
            Audio isn't supported in this browser
          </p>
        )}

        {controls}
      </section>
    </>
  );
}

/** O selo da última paragem: cai no cartão como um carimbo (sem animação com reduced motion). */
function FinaleStamp() {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-9 right-4 grid size-18 -rotate-12 place-content-center justify-items-center gap-0.5",
        "rounded-full border-2 border-dashed border-kampus-sky bg-kampus-navy text-kampus-sky shadow-pop",
        "transition duration-500 ease-out starting:scale-150 starting:-rotate-45 starting:opacity-0 motion-reduce:transition-none",
        "short:top-2 short:right-3 short:size-14 lg:-top-10 lg:right-6 lg:size-22",
      )}
    >
      <Check className="size-6 short:size-4 lg:size-7" strokeWidth={3} />
      <span className="text-[0.625rem] leading-none font-semibold tracking-wider uppercase short:text-[0.5rem]">
        {TOTAL}/{TOTAL} stops
      </span>
    </span>
  );
}
