import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("seed", () => {
  it("recusa correr com DATABASE_URL definido sem --allow-remote", () => {
    const script = fileURLToPath(new URL("../src/seed.ts", import.meta.url));
    const res = spawnSync(process.execPath, [script, "--reset"], {
      env: { ...process.env, DATABASE_URL: "postgres://user:pass@db.example.com/kampus" },
      encoding: "utf8",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/Seed refused/);
  });
});
