import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiRequestError, isNotFound, isTimeout, REQUEST_TIMEOUT_MS } from "./client.ts";

describe("isNotFound", () => {
  it("só um 404 da API", () => {
    expect(isNotFound(new ApiRequestError(404, { error: "Note not found." }))).toBe(true);
    expect(isNotFound(new ApiRequestError(409, { error: "Limit" }))).toBe(false);
    expect(isNotFound(new Error("404"))).toBe(false);
  });
});

describe("api: tempo esgotado e sem rede", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("um pedido sem resposta falha ao fim de REQUEST_TIMEOUT_MS", async () => {
    vi.useFakeTimers();
    // Um fetch que só acaba quando é abortado.
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    const pending = api("/tasks").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    const error = await pending;
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(isTimeout(error)).toBe(true);
  });

  it("sem rede diz que está offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    const error = await api("/tasks").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).message).toMatch(/offline/);
    expect(isTimeout(error)).toBe(false);
  });
});
