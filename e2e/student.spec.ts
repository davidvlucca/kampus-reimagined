import { expect, test } from "@playwright/test";
import { expectAccessible, loginAs, resetDemo } from "./helpers.ts";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("um clique no Welcome abre a demo de aluno e a visita, que se faz até ao fim", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("button", { name: "Try as student" }).click();
  await expect(page).toHaveURL(/\/app\/tour$/);
  await expect(page.getByText("STOP 1/7")).toBeVisible();
  await expectAccessible(page);

  // Perguntas ao guia: a tecla 1 faz a primeira e a resposta substitui a fala.
  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: "What time do classes start?" })).toHaveAttribute("aria-pressed", "true");
  // Duas cópias visíveis: a fala e o texto para leitores de ecrã.
  await expect(page.getByText(/Classes run from 9:00 to 18:00/).filter({ visible: true }).first()).toBeVisible();
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

  // click() e não check(): a caixa muda de forma otimista logo a seguir ao clique.
  await task.click();
  await expect(task).toBeChecked();
  // O Radix duplica o texto do toast para o leitor de ecrã: basta o primeiro.
  await expect(page.getByText("Task done. Nice!").first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Join the cohort chat and say hi/ })).toBeChecked();
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
