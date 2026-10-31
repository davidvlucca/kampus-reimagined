import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "shared", include: ["shared/src/**/*.test.ts"] } },
      {
        test: {
          name: "shared-tz",
          include: ["shared/src/**/*.test.ts"],
          // Repete os testes de datas noutros fusos: o resultado tem de ser o mesmo.
          env: { TZ: "America/Los_Angeles" },
        },
      },
      { test: { name: "shared-tz-east", include: ["shared/src/**/*.test.ts"], env: { TZ: "Pacific/Auckland" } } },
      { test: { name: "server", include: ["server/test/**/*.test.ts"], testTimeout: 20_000, hookTimeout: 30_000 } },
    ],
  },
});
