import type { GuideFace, TourStop } from "@kampus/shared";
import { Check } from "lucide-react";
import { useId, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/cn.ts";
import { GuidePortrait } from "./GuidePortrait.tsx";

interface Props {
  cardRef: RefObject<HTMLElement | null>;
  stop: TourStop;
  face: GuideFace;
  /** "Nome · Cargo" (ou só o cargo, enquanto os contactos carregam). */
  guideLabel: string;
  guideName: string;
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
  /** A fila de botões (Back, áudio, Next). */
  controls: ReactNode;
}

/** O guia e a caixa de diálogo: a fala, as perguntas e os controlos. */
export function GuideDialog({
  cardRef,
  stop,
  face,
  guideLabel,
  guideName,
  shown,
  done,
  finish,
  question,
  asked,
  onAsk,
  showQuestions,
  speechSupported,
  audioHintId,
  controls,
}: Props) {
  const askId = useId();
  return (
    <>
      <GuidePortrait guide={stop.guide} face={face} className="absolute -bottom-8 left-0 hidden h-[min(58dvh,520px)] lg:grid" imgClassName="h-full w-auto" />
      <section
        ref={cardRef}
        tabIndex={-1}
        aria-label="Guide"
        className={cn(
          "pointer-events-auto relative rounded-[var(--radius-card)] bg-kampus-navy/95 p-5 shadow-pop ring-1 ring-white/15",
          "short:min-h-0 short:overflow-y-auto short:p-3.5 lg:ml-72 lg:p-7 lg:backdrop-blur",
        )}
      >
        <div className="flex items-center gap-3">
          <GuidePortrait
            guide={stop.guide}
            face={face}
            className="size-14 shrink-0 overflow-hidden rounded-full bg-kampus-sky-soft ring-2 ring-kampus-sky short:size-9 md:size-20 lg:hidden"
            imgClassName="size-full object-cover object-top"
          />
          <p className="rounded-lg bg-kampus-sky px-3 py-1 text-sm font-semibold text-kampus-ink">{guideLabel}</p>
        </div>

        {/* Clicar no texto mostra-o todo (no teclado: Enter) */}
        <div onClick={finish} className={cn("mt-4 grid text-base leading-relaxed short:mt-2 short:text-sm md:text-lg", !done && "cursor-pointer")}>
          {/* As versões invisíveis reservam o espaço da fala mais longa da paragem (com as
              respostas), para a caixa não mudar de altura ao fazer uma pergunta */}
          {[stop.text, ...stop.questions.map((q) => q.answer)].map((text, i) => (
            <p key={i} aria-hidden className="invisible [grid-area:1/1]">
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
