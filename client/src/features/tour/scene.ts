// Os cenários são SVG: um só ficheiro serve para qualquer largura de ecrã.
/** Pré-carrega o cenário seguinte, para a mudança de paragem ser imediata. */
export function preloadScene(scene: string) {
  const img = new Image();
  img.src = scene;
}
