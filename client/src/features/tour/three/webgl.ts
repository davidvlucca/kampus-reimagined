let cached: boolean | undefined;

/** Há WebGL neste browser? Testa uma vez e guarda a resposta. */
export function canUseWebGL(): boolean {
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    cached = Boolean(gl);
    // Não deixa um contexto de teste aberto o resto da sessão.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
