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

/** Um pedido que não responde em 15 s falha (senão o ecrã ficava a carregar para sempre). */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Falha antes de haver resposta: tempo esgotado, sem rede ou servidor inacessível (status 0). */
function networkError(timedOut: boolean): ApiRequestError {
  if (timedOut) return new ApiRequestError(0, { error: "The server is taking too long to respond. Please try again.", timeout: true });
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return new ApiRequestError(0, { error: "You're offline. Check your connection and try again.", offline: true });
  }
  return new ApiRequestError(0, { error: "Can't reach the server. Check your connection and try again." });
}

/** Resposta 200 que não tem a forma esperada. */
export function unexpectedResponse(): ApiRequestError {
  return new ApiRequestError(0, { error: "The server sent an unexpected response. Please try again." });
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  // O tempo conta até o corpo chegar todo, não só até aos cabeçalhos.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`/api${path}`, {
        method: init.method ?? "GET",
        credentials: "same-origin",
        headers: init.body === undefined ? undefined : { "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      throw networkError(controller.signal.aborted);
    }
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => {
      if (controller.signal.aborted) throw networkError(true);
      return {};
    });
    if (!res.ok) {
      const body = (data && typeof data === "object" ? data : {}) as ApiError & Record<string, unknown>;
      throw new ApiRequestError(res.status, { ...body, error: body.error ?? "Something went wrong. Please try again." });
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** O pedido esgotou o tempo: não vale a pena repetir logo (seriam mais 15 s de espera). */
export function isTimeout(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 0 && error.body.timeout === true;
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
