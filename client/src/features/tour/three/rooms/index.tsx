import type { ReactNode } from "react";
import type { RoomId } from "../layout.ts";
import { CoreRoom } from "./Core.tsx";
import { DataRoom } from "./Data.tsx";
import { EntranceRoom } from "./Entrance.tsx";
import { KitchenLoungeRoom } from "./KitchenLounge.tsx";
import { MeetingRoom } from "./MeetingRoom.tsx";
import { OpenSpaceRoom } from "./OpenSpace.tsx";
import { UxUiRoom } from "./UxUi.tsx";
import { WebDevRoom } from "./WebDev.tsx";

/** Os móveis do rés-do-chão, feitos só com caixas, cilindros e planos. O terraço é à parte (RoofLevel). */
export const FURNITURE: Partial<Record<RoomId, ReactNode>> = {
  entrance: <EntranceRoom />,
  "web-dev": <WebDevRoom />,
  "ux-ui": <UxUiRoom />,
  data: <DataRoom />,
  "open-space": <OpenSpaceRoom />,
  kitchen: <KitchenLoungeRoom />,
  meeting: <MeetingRoom />,
  core: <CoreRoom />,
};
