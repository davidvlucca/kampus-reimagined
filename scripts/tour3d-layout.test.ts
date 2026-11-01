import { TOUR_STOPS } from "@kampus/shared";
import { describe, expect, it } from "vitest";
import { ROOM_D, ROOM_W, roomById, roomOfStop, ROOMS } from "../client/src/features/tour/three/layout.ts";

describe("planta 3D", () => {
  it("cada paragem tem sala; só a despedida é na vista geral", () => {
    TOUR_STOPS.forEach((stop, i) => {
      if (stop.id === "farewell") expect(roomOfStop(i)).toBeNull();
      else expect(roomOfStop(i), stop.id).not.toBeNull();
    });
  });

  it("as salas não se sobrepõem", () => {
    for (const a of ROOMS)
      for (const b of ROOMS) {
        if (a === b) continue;
        const apart = Math.abs(a.x - b.x) >= ROOM_W || Math.abs(a.z - b.z) >= ROOM_D;
        expect(apart, `${a.id} / ${b.id}`).toBe(true);
      }
  });

  it("a volta fecha: cada paragem fica ao lado da anterior (a câmara nunca passa por cima de outra sala)", () => {
    const rooms = TOUR_STOPS.map((_, i) => roomOfStop(i) ?? "entrance").map(roomById);
    for (let i = 1; i < rooms.length; i++) {
      const [a, b] = [rooms[i - 1]!, rooms[i]!];
      const dx = Math.round(Math.abs(a.x - b.x) / ROOM_W);
      const sameRow = a.z === b.z;
      // Na mesma fila: a sala ao lado. Entre filas: a que está em frente, do outro lado do corredor.
      expect(sameRow ? dx === 1 : dx === 0, `${a.id} → ${b.id}`).toBe(true);
    }
  });
});
