import { TOUR_STOPS } from "@kampus/shared";
import { describe, expect, it } from "vitest";
import {
  areaAt,
  connections,
  DOORS,
  ROOFTOP,
  roomOfStop,
  ROOMS,
  SHELL_D,
  SHELL_W,
  stopOfRoom,
  WALLS,
  type Area,
} from "../client/src/features/tour/three/layout.ts";

describe("planta 3D", () => {
  it("cada paragem tem sala; só a despedida é na vista geral", () => {
    TOUR_STOPS.forEach((stop, i) => {
      if (stop.id === "farewell") expect(roomOfStop(i)).toBeNull();
      else expect(roomOfStop(i), stop.id).not.toBeNull();
    });
  });

  it("as salas cabem no edifício de 17 × 28 m e não se sobrepõem", () => {
    for (const r of ROOMS) {
      expect(r.px >= 0 && r.py >= 0 && r.px + r.w <= SHELL_W && r.py + r.d <= SHELL_D, r.id).toBe(true);
      for (const o of ROOMS) {
        if (o === r) continue;
        const apart = r.px + r.w <= o.px || o.px + o.w <= r.px || r.py + r.d <= o.py || o.py + o.d <= r.py;
        expect(apart, `${r.id} / ${o.id}`).toBe(true);
      }
    }
  });

  it("as áreas batem com a planta aprovada", () => {
    const m2 = Object.fromEntries(ROOMS.map((r) => [r.id, Math.round(r.w * r.d)]));
    expect(m2).toMatchObject({ "ux-ui": 53, "web-dev": 71, meeting: 26, entrance: 60, data: 45, "open-space": 68, kitchen: 68 });
  });

  it("só as paragens se clicam e têm etiqueta (a reunião e o núcleo não)", () => {
    for (const r of ROOMS) {
      const isStop = stopOfRoom(r.id) >= 0;
      expect(r.label !== null, r.id).toBe(isStop);
    }
    expect(stopOfRoom("meeting")).toBe(-1);
    expect(stopOfRoom("core")).toBe(-1);
  });

  it("as etiquetas são o início do nome da paragem", () => {
    for (const r of [...ROOMS, ROOFTOP]) {
      if (r.label === null) continue;
      const stop = TOUR_STOPS[stopOfRoom(r.id)]!;
      expect(stop.name.startsWith(r.label), `${r.label} / ${stop.name}`).toBe(true);
    }
  });

  it("cada porta fica entre as duas zonas que diz ligar", () => {
    for (const d of DOORS) {
      const mid = (d.from + d.to) / 2;
      const e = 0.3;
      const sides = d.alongX ? [areaAt(mid, d.at - e), areaAt(mid, d.at + e)] : [areaAt(d.at - e, mid), areaAt(d.at + e, mid)];
      expect(sides.sort(), `${d.a} / ${d.b}`).toEqual([d.a, d.b].sort());
    }
  });

  it("nenhuma parede tapa uma porta", () => {
    for (const d of DOORS) {
      const mid = (d.from + d.to) / 2;
      const [px, py] = d.alongX ? [mid, d.at] : [d.at, mid];
      const blocked = WALLS.some((w) => {
        const [wx0, wz0] = [w.x + SHELL_W / 2, w.z + SHELL_D / 2];
        return w.alongX === d.alongX && (d.alongX ? Math.abs(wz0 - py) < 0.01 && Math.abs(wx0 - px) < w.length / 2 : Math.abs(wx0 - px) < 0.01 && Math.abs(wz0 - py) < w.length / 2);
      });
      expect(blocked, `${d.a} / ${d.b}`).toBe(false);
    }
  });

  it("de cada paragem chega-se à seguinte por uma porta, pelo corredor ou pelas escadas, sem atravessar outra sala", () => {
    const links = connections();
    // Só se passa pelo corredor e pelo núcleo (escadas): nunca por dentro de outra sala.
    const passage = new Set<Area>(["corridor", "core"]);
    const reachable = (from: Area, to: Area) => {
      const seen = new Set<Area>([from]);
      const queue: Area[] = [from];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const [a, b] of links) {
          const next = a === cur ? b : b === cur ? a : null;
          if (!next || seen.has(next)) continue;
          if (next === to) return true;
          if (passage.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      return false;
    };
    const rooms = TOUR_STOPS.map((_, i) => roomOfStop(i)).filter((r) => r !== null);
    for (let i = 1; i < rooms.length; i++) expect(reachable(rooms[i - 1]!, rooms[i]!), `${rooms[i - 1]} → ${rooms[i]}`).toBe(true);
    // A porta principal dá para a Entrance, onde a visita começa.
    expect(reachable("outside", rooms[0]!)).toBe(true);
  });
});
