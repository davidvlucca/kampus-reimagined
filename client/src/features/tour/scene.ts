// srcSet dos cenários: X.webp tem 1600px e X-900.webp tem 900px.
export const SCENE_SIZES = "100vw";

export function sceneSrcSet(scene: string): string {
  return `${scene.replace(/\.webp$/, "-900.webp")} 900w, ${scene} 1600w`;
}
