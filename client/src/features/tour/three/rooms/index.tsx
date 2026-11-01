import type { ReactNode } from "react";
import type { RoomId } from "../layout.ts";
import { DataRoom } from "./Data.tsx";
import { EntranceRoom } from "./Entrance.tsx";
import { KitchenRoom } from "./Kitchen.tsx";
import { LoungeRoom } from "./Lounge.tsx";
import { UxUiRoom } from "./UxUi.tsx";
import { WebDevRoom } from "./WebDev.tsx";

/** Os móveis de cada sala, feitos só com caixas, cilindros e planos. */
export const FURNITURE: Record<RoomId, ReactNode> = {
  entrance: <EntranceRoom />,
  "web-dev": <WebDevRoom />,
  "ux-ui": <UxUiRoom />,
  data: <DataRoom />,
  kitchen: <KitchenRoom />,
  lounge: <LoungeRoom />,
};
