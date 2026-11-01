import { describe, expect, it } from "vitest";
import { ApiRequestError, isNotFound } from "./client.ts";

describe("isNotFound", () => {
  it("só um 404 da API", () => {
    expect(isNotFound(new ApiRequestError(404, { error: "Note not found." }))).toBe(true);
    expect(isNotFound(new ApiRequestError(409, { error: "Limit" }))).toBe(false);
    expect(isNotFound(new Error("404"))).toBe(false);
  });
});
