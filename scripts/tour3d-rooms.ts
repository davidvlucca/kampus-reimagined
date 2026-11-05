// Prints de trabalho das salas da visita 3D (não vão para o README).
// Uso: node scripts/tour3d-rooms.ts [sala…] [--size=LxA]   ex.: node scripts/tour3d-rooms.ts web-dev rooftop
// Escreve test-results/rooms/<sala>-desktop.png e -mobile.png. Sem salas: todas.
import { mkdirSync, rmSync } from "node:fs";
import { chromium } from "@playwright/test";
import { DEMO_PASSWORD } from "../shared/src/demo.ts";
import { TOUR_STOPS } from "../shared/src/tour.ts";
import { startStack } from "./stack.ts";

const OUT = "test-results/rooms";
const ROOMS = ["entrance", "web-dev", "ux-ui", "data", "open-space", "kitchen", "rooftop"];
const wanted = process.argv.slice(2).filter((a) => ROOMS.includes(a));
// --size=1512x760 troca o tamanho do print de desktop (ex.: um portátil com o browser aberto).
const size = process.argv.find((a) => a.startsWith("--size="))?.slice(7).split("x").map(Number);
const desktop = size?.length === 2 && size.every((n) => n > 0) ? { width: size[0]!, height: size[1]! } : { width: 1440, height: 900 };
const rooms = wanted.length ? wanted : ROOMS;

// Portas e base próprias, para poder correr ao mesmo tempo que outro.
const offset = process.pid % 500;
const stack = await startStack(`rooms-${process.pid}`, { api: 3400 + offset, web: 4400 + offset });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
mkdirSync(OUT, { recursive: true });
try {
  for (const [name, viewport] of [
    ["desktop", desktop],
    ["mobile", { width: 390, height: 844 }],
  ] as const) {
    const context = await browser.newContext({ baseURL: stack.baseUrl, viewport, deviceScaleFactor: name === "mobile" ? 2 : 1 });
    await context.request.post("/api/auth/login", { data: { email: "student@example.com", password: DEMO_PASSWORD, portal: "student" } });
    const page = await context.newPage();
    await page.goto("/app/tour");
    await page.locator('[data-tour-view="room"]').waitFor({ timeout: 20_000 });
    for (const room of rooms) {
      const index = TOUR_STOPS.findIndex((s) => s.id === room);
      await page.getByRole("button", { name: `Go to stop ${index + 1}: ${TOUR_STOPS[index]!.name}` }).click();
      await page.waitForTimeout(1600);
      await page.screenshot({ path: `${OUT}/${room}-${name}.png` });
      console.log(`  ${OUT}/${room}-${name}.png`);
    }
    await page.getByRole("button", { name: "Back to map" }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/map-${name}.png` });
    await context.close();
  }
} finally {
  await browser.close();
  stack.stop();
  rmSync(`server/.data/rooms-${process.pid}`, { recursive: true, force: true });
}
