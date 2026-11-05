// Prints dos ecrãs principais em docs/prints/ (desktop 1440 e mobile 390).
// Os nomes repetem os de docs/antes/ (2023) quando o ecrã existe nos dois.
// Uso: npm run prints  (usa o Chromium do Playwright: npx playwright install chromium)
//      npm run prints -- --tour-3d  (só os prints da visita 3D)
import { mkdirSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../shared/src/demo.ts";
import { BROWSER_NOW, startStack } from "./stack.ts";

const OUT = "docs/prints";
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;
type ViewportName = keyof typeof VIEWPORTS;

interface Shot {
  name: string;
  path: string | ((page: Page) => Promise<string>);
  /** Espera por este texto antes do print. */
  waitFor?: string;
}

const PUBLIC: Shot[] = [
  { name: "landing", path: "/", waitFor: "Welcome!" },
  { name: "landing-login-aluno", path: "/login/student", waitFor: "Student login" },
  { name: "login-staff", path: "/login/staff", waitFor: "Staff login" },
  { name: "dashboard-sem-sessao", path: "/app", waitFor: "Please log in" },
  { name: "rota-inexistente", path: "/this-page-does-not-exist", waitFor: "404" },
];

const STUDENT: Shot[] = [
  { name: "visita-virtual", path: "/app/tour", waitFor: "I'm Marta, the Program Manager" },
  { name: "dashboard-aluno", path: "/app", waitFor: "Hi Diana!" },
  { name: "tarefas", path: "/app/tasks", waitFor: "Sign the learning agreement" },
  {
    name: "notas",
    // Desktop: lista + editor da primeira nota. Mobile: a lista.
    path: async (page) => {
      if ((page.viewportSize()?.width ?? 0) < 1024) return "/app/notes";
      const res = await page.request.get("/api/notes");
      const { notes } = (await res.json()) as { notes: { id: string }[] };
      return `/app/notes/${notes[0]?.id ?? ""}`;
    },
    waitFor: "Ideas for the first project",
  },
  { name: "contactos-staff", path: "/app/contacts", waitFor: "Marta Lopes" },
  { name: "perfil-aluno", path: "/app/profile", waitFor: "Change password" },
];

const STAFF: Shot[] = [
  { name: "dashboard-staff", path: "/staff", waitFor: "Hi Marta!" },
  { name: "alunos-staff", path: "/staff/students", waitFor: "Diana" },
  { name: "tarefas-turma-staff", path: "/staff/assignments", waitFor: "See who" },
  { name: "perfil-staff", path: "/staff/profile", waitFor: "Change password" },
];

async function newContext(browser: Browser, baseURL: string, viewport: ViewportName) {
  const context = await browser.newContext({ ...VIEWPORTS[viewport], baseURL, reducedMotion: "reduce", locale: "en-GB", timezoneId: "Europe/Lisbon" });
  await context.clock.setFixedTime(BROWSER_NOW);
  return context;
}

async function login(context: BrowserContext, email: string, portal: "staff" | "student") {
  const res = await context.request.post("/api/auth/login", { data: { email, password: DEMO_PASSWORD, portal } });
  if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()}`);
}

async function shoot(context: BrowserContext, shots: Shot[], viewport: ViewportName) {
  const page = await context.newPage();
  for (const shot of shots) {
    const path = typeof shot.path === "string" ? shot.path : await shot.path(page);
    await page.goto(path, { waitUntil: "networkidle" });
    if (shot.waitFor) await page.getByText(shot.waitFor, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 10_000 });
    // Print de página inteira: a barra inferior (fixed) iria aparecer a meio da imagem; aqui fica no fim da página.
    await page.addStyleTag({ content: 'nav[aria-label="Main"].fixed { position: static !important; }' });
    await page.evaluate(() => document.fonts.ready);
    // Imagens (cenários da visita) carregadas antes do print.
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
    const file = `${OUT}/${shot.name}-${viewport}.png`;
    // O Chromium headless às vezes falha um print de página inteira alta ("Unable to capture
    // screenshot"); à segunda passa.
    await page.screenshot({ path: file, fullPage: true }).catch(async () => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: file, fullPage: true });
    });
    console.log(`  ${file}`);
  }
  await page.close();
}

/**
 * A visita 3D: o Chromium headless desenha WebGL com o SwiftShader (no CPU). Os outros prints
 * usam reduced motion, por isso a visita aparece lá em 2D (visita-virtual).
 */
async function shootTour3D(browser: Browser, baseURL: string, viewport: ViewportName) {
  const context = await browser.newContext({ ...VIEWPORTS[viewport], baseURL, reducedMotion: "no-preference", locale: "en-GB", timezoneId: "Europe/Lisbon" });
  await context.clock.setFixedTime(BROWSER_NOW);
  await login(context, "student@example.com", "student");
  const page = await context.newPage();
  await page.goto("/app/tour", { waitUntil: "networkidle" });
  const root = page.locator("[data-tour-mode]");
  if ((await root.getAttribute("data-tour-mode")) !== "3d") throw new Error("No WebGL in headless Chromium: the 3D tour fell back to 2D");
  // A visita abre na vista geral e voa sozinha para a Entrance.
  await page.locator('[data-tour-view="room"]').waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/visita-3d-sala-${viewport}.png` });
  await page.getByRole("button", { name: "Back to map" }).click();
  await page.locator('[data-tour-view="map"]').waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/visita-3d-mapa-${viewport}.png` });
  console.log(`  ${OUT}/visita-3d-{sala,mapa}-${viewport}.png`);
  await context.close();
}

mkdirSync(OUT, { recursive: true });
const stack = await startStack("prints");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const only3D = process.argv.includes("--tour-3d");
try {
  for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
    console.log(`\n${viewport}`);
    await shootTour3D(browser, stack.baseUrl, viewport);
    if (only3D) continue;
    const anon = await newContext(browser, stack.baseUrl, viewport);
    await shoot(anon, PUBLIC, viewport);
    await anon.close();

    const student = await newContext(browser, stack.baseUrl, viewport);
    await login(student, "student@example.com", "student");
    await shoot(student, STUDENT, viewport);
    await student.close();

    const staff = await newContext(browser, stack.baseUrl, viewport);
    await login(staff, "staff@example.com", "staff");
    await shoot(staff, STAFF, viewport);
    await staff.close();
  }
} finally {
  await browser.close();
  stack.stop();
}
console.log("\nPrints done.");
