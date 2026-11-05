import { expect, test } from "@playwright/test";
import { expectAccessible, loginAs, resetDemo } from "./helpers.ts";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("um clique no Welcome abre a demo de aluno e a visita, que se faz até ao fim", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("button", { name: "Explore as a student" }).click();
  await expect(page).toHaveURL(/\/app\/tour$/);
  await expect(page.getByText("STOP 1/7")).toBeVisible();
  await expectAccessible(page);

  // Perguntas ao guia: a resposta substitui a fala da paragem.
  const guide = page.getByRole("region", { name: "Guide" });
  await page.getByRole("button", { name: "What time do classes start?" }).click();
  await expect(page.getByRole("button", { name: "What time do classes start?" })).toHaveAttribute("aria-pressed", "true");
  await expect(guide.locator("p:not(.sr-only):not(.invisible)").filter({ hasText: "Classes run from 9:00 to 18:00" })).toBeVisible();
  await expect(guide.locator("p:not(.sr-only):not(.invisible)").filter({ hasText: "Let's walk around together" })).toHaveCount(0);
  await expectAccessible(page);

  // Teclado: → avança uma paragem.
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("STOP 2/7")).toBeVisible();

  for (let stop = 3; stop <= 7; stop++) {
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(`STOP ${stop}/7`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Go to my dashboard" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Hi Diana!" })).toBeVisible();
  await expectAccessible(page);

  // A visita feita não volta a abrir sozinha.
  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
});

test("marcar uma tarefa como feita fica guardado depois de recarregar (o bug de 2023)", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/app/tasks");
  const task = page.getByRole("checkbox", { name: /Join the cohort chat and say hi/ });
  await expect(task).not.toBeChecked();
  await expectAccessible(page);

  // click() e não check(): a caixa muda de forma otimista e a linha passa logo para "Done" (fechado).
  await task.click();
  // O Radix duplica o texto do toast para o leitor de ecrã: basta o primeiro.
  await expect(page.getByText("Task done. Nice!").first()).toBeVisible();
  const showDone = page.getByRole("button", { name: /^Done/ });
  await expect(showDone).toHaveAttribute("aria-expanded", "false");
  await showDone.click();
  await expect(task).toBeChecked();

  await page.reload();
  await page.getByRole("button", { name: /^Done/ }).click();
  await expect(page.getByRole("checkbox", { name: /Join the cohort chat and say hi/ })).toBeChecked();
});

test("no dashboard, a visita por fazer é a última linha e uma tarefa nova entra pelo campo rápido", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/app");
  const card = page.locator("[data-task-list]");
  await expect(card.getByText("Take the campus tour")).toBeVisible();
  await expect(card.getByRole("link", { name: "Start the tour" })).toHaveAttribute("href", "/app/tour");
  await expect(page.getByText(/1 of 8\s+steps done/)).toBeVisible();
  await expectAccessible(page);

  // Vazio: o erro aparece e a tarefa não é criada.
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Give your task a title")).toBeVisible();

  await page.getByRole("textbox", { name: "New task" }).fill("Pick up my student card");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Task added").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New task" })).toHaveValue("");
  await expect(page.getByText(/1 of 9\s+steps done/)).toBeVisible();
});

test("um aluno que abre a área de staff volta para a sua", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/staff/students");
  await expect(page).toHaveURL(/\/app(\/tour)?$/);
  expect((await page.request.get("/api/staff/students")).status()).toBe(403);
});

test("sem sessão, uma página privada pede login", async ({ page }) => {
  await page.goto("/app/notes");
  await expect(page).toHaveURL(/\/login\/student$/);
  await expect(page.getByText("Please log in to continue.")).toBeVisible();
  await expectAccessible(page);
});

test("uma rota que não existe mostra a página 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  // O vite preview responde 200 (na Vercel é 404; ver scripts/vercel-routes.test.ts).
  expect(res?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "This page took a wrong turn" })).toBeVisible();
  await expectAccessible(page);
});

for (const [path, heading] of [
  ["/app/notes", "Notes"],
  ["/app/contacts", "Staff contacts"],
  ["/app/profile", "Your profile"],
] as const) {
  test(`${path} passa no axe`, async ({ page }) => {
    await loginAs(page, "student");
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectAccessible(page);
  });
}

test.describe("visita com animações", () => {
  test.use({ reducedMotion: "no-preference" });

  test("perguntar pelo teclado não perde o foco enquanto a resposta se escreve", async ({ page }) => {
    // Visita 2D (escolhida no botão 2D/3D, que fica guardado): o 3D tem o seu próprio teste.
    await page.addInitScript(() => localStorage.setItem("kampus.tourMode", "2d"));
    await loginAs(page, "student");
    await page.goto("/app/tour");
    const question = page.getByRole("button", { name: "Where do I get my student card?" });
    await expect(question).toBeVisible({ timeout: 15_000 });
    await question.focus();
    await page.keyboard.press("Enter");
    await expect(question).toHaveAttribute("aria-pressed", "true");
    // A meio da escrita da resposta o botão continua visível e com o foco.
    await expect(question).toBeFocused();
    await expect(question).toBeVisible();
    await expect(page.getByText(/At reception, on your first morning/).filter({ visible: true }).first()).toBeVisible();
    await expect(question).toBeFocused();
  });
});
