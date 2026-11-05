import { Shadow } from "../CampusModel.tsx";
import { useMat } from "../dim.ts";
import { COLORS, CYLINDER } from "../materials.ts";
import { AtPlan, Boxes, DESK_TOP, F, WOOD, type Box } from "./parts.tsx";

// Sala de reuniões (26 m², não é paragem: reserva-se no open space), em coordenadas da planta:
// x 0–7,5, y 16,5–20. Mesa oval com seis cadeiras e um ecrã na parede oeste.

const CHAIRS: Box[] = [1.55, 2.45, 3.35].flatMap((x) => [17.38, 19.12].map((z): Box => [[x, F + 0.225, z], [0.4, 0.45, 0.4]]));
const SCREEN: Box[] = [[[0.21, F + 1.05, 18.25], [0.08, 0.6, 1.5]]];

export function MeetingRoom() {
  return (
    <AtPlan room="meeting">
      <Shadow x={2.45} z={18.25} w={3.4} d={1.4} />
      {/* Tampo oval: o cilindro partilhado esticado em x */}
      <mesh geometry={CYLINDER} material={useMat(WOOD)} position={[2.45, DESK_TOP - 0.03, 18.25]} scale={[3.1, 0.06, 1.2]} />
      <mesh geometry={CYLINDER} material={useMat("#475569")} position={[2.45, F + 0.36, 18.25]} scale={[0.14, 0.7, 0.14]} />
      <Boxes items={CHAIRS} color={COLORS.blue} />
      <Boxes items={SCREEN} color={COLORS.navy} />
    </AtPlan>
  );
}
