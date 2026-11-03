/**
 * O código de um erro do Postgres (SQLSTATE, ex.: "23505") ou do driver ("ECONNREFUSED").
 * O Drizzle embrulha o erro do driver em `cause`: procura o primeiro código na cadeia.
 */
export function pgErrorCode(error: unknown): string | undefined {
  let e: unknown = error;
  // Poucos níveis chegam (Drizzle → driver); o limite evita um ciclo de `cause`.
  for (let depth = 0; depth < 5 && e && typeof e === "object"; depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") return String(code);
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Violação de UNIQUE (ex.: dois pedidos ao mesmo tempo com o mesmo email). */
export const isUniqueViolation = (error: unknown) => pgErrorCode(error) === "23505";

/** Violação de chave estrangeira (ex.: a linha referida foi apagada entre a verificação e o insert). */
export const isForeignKeyViolation = (error: unknown) => pgErrorCode(error) === "23503";
