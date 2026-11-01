let cached: boolean | undefined;

/** Há WebGL neste browser? Testa uma vez e guarda a resposta. */
export function canUseWebGL(): boolean {
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement("canvas");
    cached = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}
