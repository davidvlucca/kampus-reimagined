import { Block } from "../CampusModel.tsx";
import { WALL_H } from "../layout.ts";
import { COLORS } from "../materials.ts";
import { AtPlan, Boxes, F, LIGHT, STEEL, type Box } from "./parts.tsx";

// Núcleo (escadas, elevador e WC; não é paragem), em coordenadas da planta: x 9,5–17, y 15–19.
// As escadas sobem para este, até ao terraço; o elevador é uma caixa fechada com a porta a oeste.

const STEPS = 8;
const TREADS: Box[] = Array.from({ length: STEPS }, (_, i): Box => {
  const h = 0.12 * (i + 1);
  return [[9.95 + i * 0.34, F + h / 2, 16.62], [0.34, h, 2.55]];
});

export function CoreRoom() {
  return (
    <AtPlan room="core">
      <Boxes items={TREADS} color={LIGHT} />
      {/* Corrimão ao longo das escadas */}
      <Block p={[11.3, F + 1.0, 17.95]} s={[2.75, 0.05, 0.05]} color={COLORS.blue} />
      {/* Elevador */}
      <Block p={[13.85, WALL_H / 2, 16.25]} s={[1.3, WALL_H, 1.3]} color={COLORS.surface} />
      <Block p={[13.19, F + 0.5, 16.25]} s={[0.03, 0.9, 0.8]} color={STEEL} />
      {/* WC: lavatório e uma porta encostada à divisória */}
      <Block p={[16.6, F + 0.42, 15.7]} s={[0.5, 0.1, 0.7]} color={COLORS.surface} />
      <Block p={[15.8, F + 0.5, 18.2]} s={[1.0, 1.0, 0.06]} color={COLORS.sky} />
    </AtPlan>
  );
}
