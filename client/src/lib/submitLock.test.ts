import { describe, expect, it } from "vitest";
import { createSubmitLock } from "./submitLock.ts";

describe("createSubmitLock", () => {
  it("um segundo envio enquanto o primeiro decorre é ignorado", async () => {
    const run = createSubmitLock();
    let calls = 0;
    let finish!: () => void;
    const task = () => {
      calls++;
      return new Promise<void>((resolve) => (finish = resolve));
    };
    const first = run(task);
    // O duplo clique: chega no mesmo tick, antes de qualquer re-render.
    await run(task);
    expect(calls).toBe(1);
    finish();
    await first;
  });

  it("depois de acabar (mesmo com erro) volta a aceitar", async () => {
    const run = createSubmitLock();
    let calls = 0;
    await expect(
      run(async () => {
        calls++;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await run(async () => {
      calls++;
    });
    expect(calls).toBe(2);
  });
});
