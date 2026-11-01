import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { PerspectiveCamera } from "three";
import { PLAN, ROOM_D, ROOM_W, roomById, WALL_H, type RoomId } from "./layout.ts";

const FLY_S = 0.9;
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
  tz: number;
  /** 0 = câmara a sul a olhar para norte; -90° = a oeste a olhar para este (telemóvel ao alto). */
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
  // assim a planta não roda a meio da visita.
  const portrait = window.innerHeight > window.innerWidth * 1.1;
  const azimuth = portrait ? -90 * DEG : 0;
  const shiftX = width / 2 - (insets.left + bandW / 2);
  const shiftY = height / 2 - (insets.top + bandH / 2);

  const target = room ? roomById(room) : { x: 0, z: 0 };
  const w = room ? ROOM_W : PLAN.width;
  const d = room ? ROOM_D : PLAN.depth;
  // Medidas como a câmara as vê: ao alto, a planta está rodada 90°.
  const across = portrait ? d : w;
  const along = portrait ? w : d;
  const elevation = (room ? 62 : 52) * DEG;

  const tanV = Math.tan((fov * DEG) / 2) * (bandH / height);
  const tanH = Math.tan((fov * DEG) / 2) * (bandW / height);
  const tall = along * Math.sin(elevation) + WALL_H * Math.cos(elevation);
  const margin = room ? 1.3 : 1.14;
  const distance = Math.max(across / 2 / tanH, tall / 2 / tanV) * margin + (along / 2) * Math.cos(elevation);

  return { tx: target.x, tz: target.z, azimuth, elevation, distance, shiftX, shiftY };
}

function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * k;
  return {
    tx: l(a.tx, b.tx),
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
  camera.position.set(p.tx + ground * Math.sin(p.azimuth), p.distance * Math.sin(p.elevation), p.tz + ground * Math.cos(p.azimuth));
  camera.lookAt(p.tx, 0, p.tz);
  camera.setViewOffset(width, height, p.shiftX, p.shiftY, width, height);
  camera.updateProjectionMatrix();
}

/**
 * Leva a câmara à vista geral (room = null) ou a uma sala, num voo de 0,9 s.
 * Com `instant` (reduced motion escolhido à mão) muda logo, sem voo.
 */
export function CameraRig({ room, insets, instant }: { room: RoomId | null; insets: Insets; instant: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const current = useRef<Pose | null>(null);
  const flight = useRef<{ from: Pose; to: Pose; t: number } | null>(null);

  const goal = useMemo(() => poseFor(room, width, height, insets, camera.fov), [room, width, height, insets, camera.fov]);

  useEffect(() => {
    if (!current.current || instant) {
      current.current = goal;
      flight.current = null;
      applyPose(camera, goal, width, height);
    } else {
      flight.current = { from: current.current, to: goal, t: 0 };
    }
    invalidate();
  }, [goal, instant, camera, width, height, invalidate]);

  useFrame((_, delta) => {
    const f = flight.current;
    if (!f) return;
    // Depois de muito tempo parado (frameloop "demand") o delta pode ser enorme; o limite de
    // 0,1 s evita esse salto sem tornar o voo mais lento num telemóvel a poucos frames.
    f.t = Math.min(1, f.t + Math.min(delta, 0.1) / FLY_S);
    const pose = lerpPose(f.from, f.to, easeInOutCubic(f.t));
    current.current = pose;
    applyPose(camera, pose, width, height);
    if (f.t < 1) invalidate();
    else flight.current = null;
  });

  return null;
}
