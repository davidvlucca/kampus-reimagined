import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { PerspectiveCamera } from "three";
import { PLAN, ROOF_Y, roomById, WALL_H, type RoomId } from "./layout.ts";

const FLY_S = 0.9;
/** O mergulho para dentro de uma sala é mais lento: acaba devagar, enquanto a ilustração aparece. */
const DIVE_S = 1.2;
const DEG = Math.PI / 180;

/** Margens do canvas tapadas pelo topo, pelo diálogo e pelos botões (px). A sala vai para o resto. */
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Pose {
  tx: number;
  /** Altura do alvo: 0 no rés-do-chão, a do terraço no rooftop (a câmara sobe com ele). */
  ty: number;
  tz: number;
  /** 0 = câmara a sul a olhar para norte (telemóvel ao alto); -90° = a oeste a olhar para este. */
  azimuth: number;
  elevation: number;
  distance: number;
  /** Deslocação da imagem (px) para o alvo ficar no meio da área livre. */
  shiftX: number;
  shiftY: number;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function poseFor(room: RoomId | null, width: number, height: number, insets: Insets, fov: number): Pose {
  const bandW = Math.max(width - insets.left - insets.right, width * 0.3);
  const bandH = Math.max(height - insets.top - insets.bottom, height * 0.3);
  // A orientação vem do ecrã (não do canvas, que muda de altura entre o mapa e a sala):
  // assim a planta não roda a meio da visita. O edifício é comprido de norte a sul: ao alto vê-se
  // de sul (o rio à frente); deitado, de oeste (a rua e a porta principal à frente, o rio à direita).
  const portrait = window.innerHeight > window.innerWidth * 1.1;
  const azimuth = portrait ? 0 : -90 * DEG;
  const shiftX = width / 2 - (insets.left + bandW / 2);
  const shiftY = height / 2 - (insets.top + bandH / 2);

  const target = room ? roomById(room) : { x: 0, z: 0, w: PLAN.width, d: PLAN.depth };
  const ty = room === "rooftop" ? ROOF_Y : 0;
  // Medidas como a câmara as vê: deitado, a planta está rodada 90°.
  const across = portrait ? target.w : target.d;
  const along = portrait ? target.d : target.w;
  // Dentro de uma sala a câmara desce mais rente (como quem entra pela porta).
  const elevation = (room ? 44 : 52) * DEG;

  const tanV = Math.tan((fov * DEG) / 2) * (bandH / height);
  const tanH = Math.tan((fov * DEG) / 2) * (bandW / height);
  const tall = along * Math.sin(elevation) + WALL_H * Math.cos(elevation);
  // Numa sala, a margem abaixo de 1 deixa a sala encher a faixa livre e sair dela: já se está lá dentro.
  const margin = room ? 0.5 : 1.14;
  const distance = Math.max(across / 2 / tanH, tall / 2 / tanV) * margin + (along / 2) * Math.cos(elevation);

  return { tx: target.x, ty, tz: target.z, azimuth, elevation, distance, shiftX, shiftY };
}

function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * k;
  return {
    tx: l(a.tx, b.tx),
    ty: l(a.ty, b.ty),
    tz: l(a.tz, b.tz),
    azimuth: l(a.azimuth, b.azimuth),
    elevation: l(a.elevation, b.elevation),
    distance: l(a.distance, b.distance),
    shiftX: l(a.shiftX, b.shiftX),
    shiftY: l(a.shiftY, b.shiftY),
  };
}

function applyPose(camera: PerspectiveCamera, p: Pose, width: number, height: number) {
  const ground = p.distance * Math.cos(p.elevation);
  camera.position.set(p.tx + ground * Math.sin(p.azimuth), p.ty + p.distance * Math.sin(p.elevation), p.tz + ground * Math.cos(p.azimuth));
  camera.lookAt(p.tx, p.ty, p.tz);
  camera.setViewOffset(width, height, p.shiftX, p.shiftY, width, height);
  camera.updateProjectionMatrix();
}

interface Leg {
  to: Pose;
  s: number;
}

/**
 * Leva a câmara à vista geral (room = null) ou para dentro de uma sala. De uma sala para outra
 * sai primeiro para a vista geral e volta a mergulhar. Avisa (`onSettled`) quando a câmara para.
 * Com `instant` (reduced motion escolhido à mão) muda logo, sem voo.
 */
export function CameraRig({
  room,
  insets,
  instant,
  onSettled,
}: {
  room: RoomId | null;
  insets: Insets;
  instant: boolean;
  onSettled: (room: RoomId | null) => void;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const current = useRef<Pose | null>(null);
  const flight = useRef<{ from: Pose; legs: Leg[]; t: number } | null>(null);
  const lastRoom = useRef<RoomId | null>(null);
  const settled = useRef(onSettled);

  useEffect(() => {
    settled.current = onSettled;
  }, [onSettled]);

  const goal = useMemo(() => poseFor(room, width, height, insets, camera.fov), [room, width, height, insets, camera.fov]);
  const overview = useMemo(() => poseFor(null, width, height, insets, camera.fov), [width, height, insets, camera.fov]);

  useEffect(() => {
    const from = lastRoom.current;
    lastRoom.current = room;
    if (!current.current || instant) {
      current.current = goal;
      flight.current = null;
      applyPose(camera, goal, width, height);
      settled.current(room);
    } else if (from === room && !flight.current) {
      // Parada e com o mesmo destino (o ecrã mudou de tamanho): acerta já, sem voo, senão o
      // primeiro frame saía esticado com a projeção antiga.
      current.current = goal;
      applyPose(camera, goal, width, height);
    } else if (from === room && flight.current) {
      // Mesmo destino com outra medida (o cartão do diálogo cresce enquanto a fala se escreve):
      // corrige o fim do voo sem o recomeçar nem saltar a passagem pelo mapa.
      const legs = flight.current.legs;
      legs[legs.length - 1]!.to = goal;
      if (legs.length > 1) legs[0]!.to = overview;
    } else {
      const legs: Leg[] =
        from && room && from !== room
          ? [
              { to: overview, s: FLY_S },
              { to: goal, s: DIVE_S },
            ]
          : [{ to: goal, s: room ? DIVE_S : FLY_S }];
      flight.current = { from: current.current, legs, t: 0 };
    }
    invalidate();
  }, [goal, overview, room, instant, camera, width, height, invalidate]);

  useFrame((_, delta) => {
    const f = flight.current;
    if (!f) return;
    const leg = f.legs[0]!;
    // Depois de muito tempo parado (frameloop "demand") o delta pode ser enorme; o limite de
    // 0,1 s evita esse salto sem tornar o voo mais lento num telemóvel a poucos frames.
    f.t = Math.min(1, f.t + Math.min(delta, 0.1) / leg.s);
    const pose = lerpPose(f.from, leg.to, easeInOutCubic(f.t));
    current.current = pose;
    applyPose(camera, pose, width, height);
    if (f.t < 1) {
      invalidate();
    } else if (f.legs.length > 1) {
      f.from = leg.to;
      f.legs.shift();
      f.t = 0;
      invalidate();
    } else {
      flight.current = null;
      settled.current(lastRoom.current);
    }
  });

  return null;
}
