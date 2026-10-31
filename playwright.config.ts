// Testes de ponta a ponta (npm run e2e): uma cópia isolada da app (scripts/stack.ts) num
// Chromium de desktop e noutro de telemóvel. Cada teste começa com a demo reposta.
import { defineConfig, devices } from "@playwright/test";
import { E2E_PORTS } from "./e2e/env.ts";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Uma base partilhada e reposta antes de cada teste: um de cada vez.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${E2E_PORTS.web}`,
    locale: "en-GB",
    timezoneId: "Europe/Lisbon",
    // Sem animações: o texto da visita aparece todo de uma vez.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
