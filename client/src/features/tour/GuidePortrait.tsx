import { guideImage, type GuideFace, type GuideId } from "@kampus/shared";
import { cn } from "../../lib/cn.ts";

const FACES: readonly GuideFace[] = ["smile", "wink", "curious", "talk"];

/**
 * O guia com uma expressão. As quatro imagens ficam empilhadas e só uma é visível:
 * trocar o `src` de uma só imagem fazia piscar enquanto a nova carregava.
 */
export function GuidePortrait({
  guide,
  face,
  className,
  imgClassName,
  desktop = false,
}: {
  guide: GuideId;
  face: GuideFace;
  className?: string;
  imgClassName?: string;
  /** O guia grande do desktop (marcado para os testes medirem o tamanho). */
  desktop?: boolean;
}) {
  return (
    <span aria-hidden data-guide-portrait={desktop ? "" : undefined} className={cn("pointer-events-none grid", className)}>
      {FACES.map((f) => (
        <img key={f} src={guideImage(guide, f)} alt="" className={cn("[grid-area:1/1]", imgClassName, f === face ? "opacity-100" : "opacity-0")} />
      ))}
    </span>
  );
}
