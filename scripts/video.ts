// Vídeo curto (< 1 min) dos fluxos do aluno e do staff, gravado com o Playwright.
// Gera docs/video/kampus-demo.webm e, se houver ffmpeg, .mp4 e um GIF curto para o README.
// Uso: npm run video
import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { BROWSER_NOW, startStack } from "./stack.ts";

const OUT = "docs/video";
const SIZE = { width: 1280, height: 720 };
const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** O botão "Explore as …" do Welcome: entra na conta demo com um clique. */
async function loginWithDemo(page: Page, profile: "student" | "staff") {
  const button = page.getByRole("button", { name: profile === "student" ? "Explore as a student" : "Explore as staff" });
  await button.hover();
  await pause(page, 500);
  await button.click();
}

async function studentFlow(page: Page) {
  await page.goto("/");
  await pause(page, 1800);
  await loginWithDemo(page, "student");

  // Primeiro login: a visita abre sozinha, na planta 3D, e voa até à Entrance.
  await page.waitForURL("**/app/tour");
  await page.locator('[data-tour-view="room"]').waitFor({ timeout: 20_000 });
  await pause(page, 1500);
  await page.keyboard.press("Enter");
  await pause(page, 1000);
  // Uma pergunta ao guia: a resposta escreve-se e a Marta muda de expressão.
  await page.getByRole("button", { name: "Where do I get my student card?" }).click();
  await pause(page, 3500);
  // Next: a câmara voa para a Web Dev.
  await page.getByRole("button", { name: "Next" }).click();
  await pause(page, 3000);
  // De volta à planta: a sala seguinte está acesa. Depois, direto para a Kitchen.
  await page.getByRole("button", { name: "Back to map" }).click();
  await pause(page, 2500);
  await page.getByRole("button", { name: "Go to stop 5: Kitchen" }).click();
  await pause(page, 3000);
  await page.keyboard.press("Escape");
  await pause(page, 1000);
  await page.keyboard.press("Escape");

  await page.waitForURL("**/app");
  await pause(page, 2500);

  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await nav.getByRole("link", { name: "Tasks" }).click();
  await pause(page, 1200);
  await page.getByPlaceholder(/student card/i).fill("Pick up my student card");
  await page.getByRole("button", { name: "Add task" }).click();
  await pause(page, 1200);
  await page.getByText("Join the cohort chat and say hi").click();
  await pause(page, 1800);

  await nav.getByRole("link", { name: "Notes" }).click();
  await pause(page, 1000);
  await page.getByText("Questions for the TA").first().click();
  await pause(page, 800);
  const body = page.getByRole("textbox").last();
  await body.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n- Is there a quiet room for focus time?", { delay: 25 });
  await page.keyboard.press("ControlOrMeta+s");
  await pause(page, 1500);

  await nav.getByRole("link", { name: "Staff" }).click();
  await pause(page, 2500);

  await page.getByRole("button", { name: "Log out" }).first().click();
  await pause(page, 1200);
}

async function staffFlow(page: Page) {
  await page.goto("/");
  await pause(page, 800);
  await loginWithDemo(page, "staff");
  await page.waitForURL("**/staff");
  await pause(page, 3000);

  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await nav.getByRole("link", { name: "Students" }).click();
  await pause(page, 1200);
  await page.getByRole("searchbox").or(page.getByPlaceholder(/search by name/i)).first().fill("dia");
  await pause(page, 1500);
  await page.getByPlaceholder(/search by name/i).fill("");
  await pause(page, 600);

  await page.getByRole("button", { name: "Add student" }).first().click();
  await pause(page, 500);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill("Alex");
  await dialog.getByLabel("Last name").fill("Rivera");
  await dialog.getByLabel("Email").fill("alex.rivera@example.com");
  await dialog.getByLabel("Cohort").selectOption({ label: "UX/UI Oct 2026" });
  await dialog.getByLabel(/password/i).fill("Welcome2026");
  await pause(page, 500);
  await dialog.getByRole("button", { name: "Add student" }).click();
  await pause(page, 2000);

  // Tarefas da turma: quem já fez o quê.
  await nav.getByRole("link", { name: "Cohort tasks" }).click();
  await pause(page, 1500);
  await page.getByRole("button", { name: "See who" }).first().click();
  await pause(page, 3000);
}

mkdirSync(OUT, { recursive: true });
const stack = await startStack("video", { api: 3102, web: 4175 });
// SwiftShader: WebGL no CPU, para a visita 3D aparecer no Chromium headless.
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const tmpDir = `${OUT}/.raw`;
try {
  const context = await browser.newContext({
    baseURL: stack.baseUrl,
    viewport: SIZE,
    recordVideo: { dir: tmpDir, size: SIZE },
    locale: "en-GB",
    timezoneId: "Europe/Lisbon",
  });
  await context.clock.install({ time: BROWSER_NOW });
  const page = await context.newPage();
  await studentFlow(page);
  await staffFlow(page);
  const video = page.video();
  await context.close();
  const raw = await video?.path();
  if (!raw) throw new Error("No video recorded");
  renameSync(raw, `${OUT}/kampus-demo.webm`);
} finally {
  await browser.close();
  stack.stop();
  rmSync(tmpDir, { recursive: true, force: true });
}

const ffmpeg = spawnSync("ffmpeg", ["-version"]);
if (ffmpeg.status === 0) {
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${OUT}/kampus-demo.webm`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-movflags", "+faststart", `${OUT}/kampus-demo.mp4`], { stdio: "inherit" });
  // GIF curto para o README: os primeiros 14 s (entrada, login e visita).
  spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-t", "14", "-i", `${OUT}/kampus-demo.webm`, "-vf", "fps=8,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer", `${OUT}/kampus-demo.gif`],
    { stdio: "inherit" },
  );
  console.log("Video done: docs/video/kampus-demo.{webm,mp4,gif}");
} else {
  console.log("Video done: docs/video/kampus-demo.webm (ffmpeg not found, skipped mp4 and GIF)");
}
