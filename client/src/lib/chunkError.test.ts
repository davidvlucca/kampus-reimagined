import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunkError.ts";

describe("isChunkLoadError", () => {
  it.each([
    // Chrome / Edge
    "Failed to fetch dynamically imported module: https://kampus.example/assets/TourPage-abc123.js",
    // Firefox
    "error loading dynamically imported module: https://kampus.example/assets/TourPage-abc123.js",
    // Safari
    "Importing a module script failed.",
    // Vite, quando falha o CSS do chunk
    "Unable to preload CSS for /assets/TourPage-abc123.css",
  ])("reconhece %j", (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it("um erro qualquer de render não é de chunk", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'name')"))).toBe(false);
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
