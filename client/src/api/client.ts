import type { ApiError } from "@kampus/shared";

/** Erro de um pedido à API, com o status e o corpo (`{ error, fields }`). */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: ApiError & Record<string, unknown>;

  constructor(status: number, body: ApiError & Record<string, unknown>) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiRequestError(0, { error: "Can't reach the server. Check your connection and try again." });
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = (data && typeof data === "object" ? data : {}) as ApiError & Record<string, unknown>;
    throw new ApiRequestError(res.status, { ...body, error: body.error ?? "Something went wrong. Please try again." });
  }
  return data as T;
}

/** Mensagem legível de qualquer erro (para toasts e estados de erro). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Please try again.";
}

/** Erros por campo devolvidos pela API (400/409), para mostrar debaixo de cada input. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiRequestError ? (error.body.fields ?? {}) : {};
}

/** A API respondeu 404: o que se queria mudar já não existe (ex.: apagado noutro separador). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}
