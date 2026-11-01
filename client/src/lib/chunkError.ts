/**
 * Um import() de um chunk que já não existe: o separador ficou aberto durante um deploy
 * e os ficheiros com hash antigos foram substituídos. Cada browser tem a sua mensagem.
 */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR.test(error.message);
}
