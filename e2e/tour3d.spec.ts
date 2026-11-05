import { TOUR_STOPS } from "../shared/src/tour.ts";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectAccessible, loginAs, resetDemo } from "./helpers.ts";

// Corre no projeto "tour-3d" (Chromium com SwiftShader: WebGL no CPU, sem GPU).

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

const root = (page: Page) => page.locator("[data-tour-mode]");
// Os voos da câmara contam frames: no SwiftShader de um CI lento podem passar dos 5 s por omissão.
const FLIGHT = { timeout: 20_000 };

/** O axe mede as cores a meio de um fade (a ilustração a sair por cima das etiquetas): espera que acabem. */
async function settled(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
}

/**
 * O R3F liberta o contexto WebGL meio segundo depois de desmontar o canvas (sair da visita, passar
 * a 2D). Devolve uma espera por esse momento, para ver a seguir que não apareceu o aviso do 2D.
 */
async function watchRelease(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { glReleased?: boolean };
    w.glReleased = false;
    document.querySelector("canvas")!.addEventListener("webglcontextlost", () => (w.glReleased = true), { once: true });
  });
  return async () => {
    await page.waitForFunction(() => (window as unknown as { glReleased?: boolean }).glReleased === true);
    // Um frame para o React desenhar o aviso, se houvesse.
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
}

/** Espera que a etiqueta pare (segue a câmara, que pode ainda estar a voar). */
async function settledBox(label: Locator) {
  let last = "";
  await expect(async () => {
    const prev = last;
    last = JSON.stringify(await label.boundingBox());
    expect(last).toBe(prev);
  }).toPass({ intervals: [400], timeout: 15_000 });
}

async function openTour3D(page: Page) {
  await loginAs(page, "student");
  await page.goto("/app/tour");
  await expect(root(page)).toHaveAttribute("data-tour-mode", "3d");
  await expect(page.locator("canvas")).toBeVisible();
  // Abre na vista geral e voa sozinha para a Entrance.
  await expect(root(page)).toHaveAttribute("data-tour-view", "room", { timeout: 15_000 });
}

test("o canvas aparece, o botão de uma sala abre o diálogo dela, o Next acende a seguinte e Back to map volta", async ({ page }) => {
  await openTour3D(page);
  await expect(page.getByRole("region", { name: "Guide" })).toContainText("Hi, I'm Marta");
  // A Entrance só conta como vista quando a câmara lá chega (ver o teste do Back to map a meio do voo).
  await expect(root(page)).toHaveAttribute("data-tour-interior", "entrance", FLIGHT);

  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-view", "map");
  await expect(page.getByRole("heading", { name: "Campus map" })).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-next-room", "web-dev");
  // No mapa acende a sala seguinte.
  await expect(page.locator("[data-lit-room]")).toHaveAttribute("data-lit-room", "web-dev");
  await settled(page);
  await expectAccessible(page);

  await page.getByRole("button", { name: "Go to stop 3: UX/UI classroom" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-view", "room");
  await expect(page.getByRole("region", { name: "Guide" })).toContainText("These walls hold your research");
  await expect(root(page)).toHaveAttribute("data-next-room", "data");
  // Dentro de uma sala acende a própria sala, não a seguinte.
  await expect(page.locator("[data-lit-room]")).toHaveAttribute("data-lit-room", "ux-ui");
  // A câmara mergulha na sala e a ilustração do 2D aparece por cima: "entrou-se".
  await expect(root(page)).toHaveAttribute("data-tour-interior", "ux-ui", FLIGHT);
  await expect(page.getByRole("img", { name: TOUR_STOPS[2]!.sceneAlt })).toBeVisible();
  await settled(page);
  await expectAccessible(page);

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("STOP 4/8")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-next-room", "open-space");

  await expect(root(page)).toHaveAttribute("data-tour-interior", "data", FLIGHT);

  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-view", "map");
  await expect(root(page)).toHaveAttribute("data-tour-interior", "");
  await expect(page.getByRole("button", { name: "Continue to Open space and phone booths" })).toBeVisible();
});

test("teclado: Esc numa sala volta ao mapa sem perder o foco; Esc no mapa sai sem marcar a visita como saltada", async ({ page }) => {
  await openTour3D(page);
  const released = await watchRelease(page);
  await page.getByRole("button", { name: "Back to map" }).focus();
  await page.keyboard.press("Enter");
  await expect(root(page)).toHaveAttribute("data-tour-view", "map");
  // O botão desapareceu: o foco passou para o título do mapa.
  await expect(page.getByRole("heading", { name: "Campus map" })).toBeFocused();

  await page.getByRole("button", { name: /Continue to|Start at/ }).focus();
  await page.keyboard.press("Enter");
  await expect(root(page)).toHaveAttribute("data-tour-view", "room");
  await expect(page.getByRole("region", { name: "Guide" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveAttribute("data-tour-view", "map");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/app$/);
  // O R3F liberta o contexto WebGL meio segundo depois de desmontar: isso não é uma falha.
  await released();
  await expect(page.getByText("Showing the 2D tour")).toHaveCount(0);
  const me = (await (await page.request.get("/api/auth/me")).json()) as { user: { tourSkippedAt: string | null } };
  expect(me.user.tourSkippedAt).toBeNull();
});

test("sem WebGL: a visita 2D, sem descarregar o 3D e sem aviso", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // Simula um browser sem WebGL.
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  const chunks: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("CampusMap")) chunks.push(r.url());
  });
  await loginAs(page, "student");
  await page.goto("/app/tour");
  await expect(root(page)).toHaveAttribute("data-tour-mode", "2d");
  await expect(page.getByText("STOP 1/8")).toBeVisible();
  await expect(page.getByRole("group", { name: "Tour view" })).toHaveCount(0);
  await expect(page.getByText("Showing the 2D tour")).toHaveCount(0);
  expect(chunks).toEqual([]);
  // Ao abrir, o foco vai para o título da página (não fica no <body>).
  await expect(page.getByRole("heading", { level: 1, name: /Campus tour/ })).toBeFocused();
});

test("se o WebGL se perder a meio, a visita continua em 2D com um aviso", async ({ page }) => {
  await openTour3D(page);
  await page.evaluate(() => {
    const gl = document.querySelector("canvas")!.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(root(page)).toHaveAttribute("data-tour-mode", "2d");
  await expect(page.getByText("Showing the 2D tour").first()).toBeVisible();
  await expect(page.getByText("STOP 1/8")).toBeVisible();
});

test("trocar 3D → 2D → 3D: sem aviso e o botão continua lá", async ({ page }) => {
  await openTour3D(page);
  await expect(page.getByRole("button", { name: "3D tour" })).toHaveAttribute("aria-pressed", "true");
  const released = await watchRelease(page);
  await page.getByRole("button", { name: "2D tour" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-mode", "2d");
  await expect(page.getByRole("button", { name: "2D tour" })).toHaveAttribute("aria-pressed", "true");
  await released();
  await expect(page.getByText("Showing the 2D tour")).toHaveCount(0);
  await page.getByRole("button", { name: "3D tour" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-mode", "3d");
  await expect(page.locator("canvas")).toBeVisible();
  // Entra logo na sala da paragem atual.
  await expect(root(page)).toHaveAttribute("data-tour-view", "room");
});

test("sair com Skip tour a partir de uma sala, depois de trocar 3D → 2D → 3D, não mostra o aviso do 2D", async ({ page }) => {
  await openTour3D(page);
  await page.getByRole("button", { name: "2D tour" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-mode", "2d");
  await page.getByRole("button", { name: "3D tour" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-view", "room");
  await expect(page.locator("canvas")).toBeVisible();
  const released = await watchRelease(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("You can take the tour anytime from the menu.").first()).toBeVisible();
  await released();
  await expect(page.getByText("Showing the 2D tour")).toHaveCount(0);
});

test("com 2D guardado, o 3D não é descarregado", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kampus.tourMode", "2d"));
  const chunks: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("CampusMap")) chunks.push(r.url());
  });
  await loginAs(page, "student");
  await page.goto("/app/tour");
  await expect(root(page)).toHaveAttribute("data-tour-mode", "2d");
  await expect(page.getByText("STOP 1/8")).toBeVisible();
  expect(chunks).toEqual([]);
});

test.describe("com reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("mostra a visita 2D sem descarregar o 3D; o 3D escolhido à mão funciona", async ({ page }) => {
    const chunks: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("CampusMap")) chunks.push(r.url());
    });
    await loginAs(page, "student");
    await page.goto("/app/tour");
    await expect(root(page)).toHaveAttribute("data-tour-mode", "2d");
    await expect(page.getByText("STOP 1/8")).toBeVisible();
    expect(chunks).toEqual([]);
    await page.getByRole("button", { name: "3D tour" }).click();
    await expect(root(page)).toHaveAttribute("data-tour-mode", "3d");
    await expect(page.locator("canvas")).toBeVisible();
  });
});

test("no mapa, clicar numa sala no 3D entra nela", async ({ page }) => {
  await openTour3D(page);
  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-view", "map");
  // Espera o voo para a vista geral acabar (as etiquetas seguem a câmara).
  const label = page.locator("[data-lit-room] span", { hasText: "UX/UI" });
  await settledBox(label);
  const box = (await label.boundingBox())!;
  // A etiqueta não recebe cliques: o clique cai no chão da sala, que está por baixo dela.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => document.body.style.cursor)).toBe("pointer");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText("STOP 3/8")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-tour-interior", "ux-ui", FLIGHT);
  // Dentro da sala, a ilustração tapa o 3D: o cursor da sala não fica preso.
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5);
  await expect.poll(() => page.evaluate(() => document.body.style.cursor)).toBe("");
});

test("o Next numa sala sai para o mapa e volta a entrar na seguinte; dentro, a ilustração tapa o 3D", async ({ page }) => {
  await openTour3D(page);
  await expect(root(page)).toHaveAttribute("data-tour-interior", "entrance", FLIGHT);
  // Dentro da sala o clique cai na ilustração, não nas salas do 3D.
  const center = await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight * 0.3)?.tagName);
  expect(center).toBe("IMG");

  // Regista as mudanças da sala "entrada", com o tempo de cada uma.
  await page.evaluate(() => {
    const el = document.querySelector("[data-tour-mode]")!;
    const log: [string, number][] = [];
    (window as unknown as { interiorLog: typeof log }).interiorLog = log;
    new MutationObserver(() => log.push([el.getAttribute("data-tour-interior") ?? "", performance.now()])).observe(el, {
      attributeFilter: ["data-tour-interior"],
    });
  });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("STOP 2/8")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-tour-interior", "web-dev", FLIGHT);
  const log = await page.evaluate(() => (window as unknown as { interiorLog: [string, number][] }).interiorLog);
  expect(log.map(([room]) => room)).toEqual(["", "web-dev"]);
  // Sobe ao mapa (0,9 s) e mergulha (1,2 s): não é uma troca direta.
  expect(log[1]![1] - log[0]![1]).toBeGreaterThan(1500);
});

test("Back to map a meio do voo não dá a sala seguinte como vista", async ({ page }) => {
  await openTour3D(page);
  await expect(root(page)).toHaveAttribute("data-tour-interior", "entrance", FLIGHT);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("STOP 2/8")).toBeVisible();
  // A câmara ainda vai a caminho da Web Dev (sobe ao mapa e mergulha): não se entrou nela.
  await expect(root(page)).toHaveAttribute("data-tour-interior", "");
  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-view", "map");
  await expect(root(page)).toHaveAttribute("data-next-room", "web-dev");
  await expect(page.getByRole("button", { name: "Continue to Web Dev classroom" })).toBeVisible();
});

test("as etiquetas das salas no mapa têm o nome das paragens", async ({ page }) => {
  await openTour3D(page);
  await page.getByRole("button", { name: "Back to map" }).click();
  const labels = await page.locator("[data-lit-room] span").allTextContents();
  // A etiqueta é o início do nome da paragem ("Web Dev classroom" → "Web Dev").
  for (const label of labels) expect(TOUR_STOPS.some((s) => s.name.startsWith(label)), label).toBe(true);
  expect(labels).toContain("Data");
  // O terraço não se vê no mapa, mas tem etiqueta (por cima das escadas); a reunião e o núcleo não são paragens.
  expect(labels).toContain("Rooftop terrace");
  expect(labels).toHaveLength(TOUR_STOPS.length - 1);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test.describe(`no telemóvel, ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test("entra, segue e volta ao mapa sem scroll lateral, com os botões dentro do ecrã", async ({ page }) => {
      await openTour3D(page);
      await expect(root(page)).toHaveAttribute("data-tour-interior", "entrance", FLIGHT);
      const inView = async (name: string | RegExp) => {
        const box = (await page.getByRole("button", { name }).boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      };
      await inView("Next");
      await page.getByRole("button", { name: "Next" }).click();
      await expect(root(page)).toHaveAttribute("data-tour-interior", "web-dev", FLIGHT);
      await page.getByRole("button", { name: "Back to map" }).click();
      await expect(root(page)).toHaveAttribute("data-tour-view", "map");
      await inView(/Continue to/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    });
  });
}

test("o foco não cai no <body>: Back até à primeira paragem, ou uma pergunta quando a paragem muda", async ({ page }) => {
  await openTour3D(page);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("STOP 2/8")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("STOP 1/8")).toBeVisible();
  // O Back ficou desativado: o foco passa para o Next.
  await expect(page.getByRole("button", { name: "Next" })).toBeFocused();

  // As perguntas aparecem quando a fala acaba (Enter mostra-a toda).
  await page.getByRole("region", { name: "Guide" }).click();
  const question = page.getByRole("group", { name: /Ask/ }).getByRole("button").first();
  await question.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("STOP 2/8")).toBeVisible();
  await expect(page.getByRole("region", { name: "Guide" })).toBeFocused();
});

test("as etiquetas do mapa seguem a câmara depois de rodar o ecrã com ela parada", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTour3D(page);
  await page.getByRole("button", { name: "Back to map" }).click();
  const label = page.locator("[data-lit-room] span", { hasText: "Web Dev" });
  const onScreen = async () => {
    const box = await label.boundingBox();
    const size = page.viewportSize()!;
    return Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height);
  };
  await expect.poll(onScreen, FLIGHT).toBe(true);
  // Roda o ecrã só com a câmara parada.
  await settledBox(label);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(onScreen, FLIGHT).toBe(true);
});

test("o terraço: a paragem 7 sobe ao rooftop, mostra a ilustração e, no mapa, a seguinte é a despedida", async ({ page }) => {
  await openTour3D(page);
  await page.getByRole("button", { name: "Go to stop 7: Rooftop terrace" }).click();
  await expect(page.getByText("STOP 7/8")).toBeVisible();
  await expect(page.locator("[data-lit-room]")).toHaveAttribute("data-lit-room", "rooftop");
  await expect(root(page)).toHaveAttribute("data-tour-interior", "rooftop", FLIGHT);
  await expect(page.getByRole("img", { name: TOUR_STOPS[6]!.sceneAlt })).toBeVisible();
  await settled(page);
  await expectAccessible(page);

  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(root(page)).toHaveAttribute("data-tour-view", "map");
  // A despedida é na vista geral: acende a Entrance, onde a visita acaba.
  await expect(root(page)).toHaveAttribute("data-next-room", "entrance");
  await expect(page.getByRole("button", { name: "Continue to See you on day 1" })).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  test.describe(`num ecrã grande, ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test("o guia fica pequeno e encostado ao diálogo; o cenário 2D enche o ecrã", async ({ page }) => {
      await openTour3D(page);
      const portrait = page.locator("[data-guide-portrait]");
      const card = page.getByRole("region", { name: "Guide" });
      await expect(portrait).toBeVisible();
      const p = (await portrait.boundingBox())!;
      const c = (await card.boundingBox())!;
      // No máximo ~360 px de altura, seja qual for o ecrã (crescia com ele e tapava o mapa).
      expect(p.height).toBeLessThanOrEqual(370);
      // Encostado à esquerda do cartão: sobrepõe-se pouco e não fica longe dele.
      expect(p.x + p.width).toBeGreaterThan(c.x);
      expect(p.x + p.width - c.x).toBeLessThan(p.width * 0.4);
      expect(p.x).toBeLessThan(c.x);

      await page.getByRole("button", { name: "2D tour" }).click();
      await expect(root(page)).toHaveAttribute("data-tour-mode", "2d");
      const scene = page.getByRole("img", { name: TOUR_STOPS[0]!.sceneAlt });
      await expect(scene).toBeVisible();
      const s = (await scene.boundingBox())!;
      // A ilustração ocupa o ecrã todo, sem faixas vazias.
      expect(s.width).toBeGreaterThanOrEqual(viewport.width - 1);
      expect(s.height).toBeGreaterThanOrEqual(viewport.height - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    });
  });
}
