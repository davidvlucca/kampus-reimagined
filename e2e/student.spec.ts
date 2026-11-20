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
  await expect(page.getByText("STOP 1/8")).toBeVisible();
  await expectAccessible(page);

  // Perguntas ao guia: a resposta substitui a fala da paragem.
  const guide = page.getByRole("region", { name: "Guide" });
  await page.getByRole("button", { name: "What if I'm late on the first day?" }).click();
  await expect(page.getByRole("button", { name: "What if I'm late on the first day?" })).toHaveAttribute("aria-pressed", "true");
  await expect(guide.locator("p:not(.sr-only):not(.invisible)").filter({ hasText: "Come in anyway and tell reception" })).toBeVisible();
  await expect(guide.locator("p:not(.sr-only):not(.invisible)").filter({ hasText: "go straight to the reception desk" })).toHaveCount(0);
  await expectAccessible(page);

  // Teclado: → avança uma paragem.
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("STOP 2/8")).toBeVisible();

  for (let stop = 3; stop <= 8; stop++) {
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(`STOP ${stop}/8`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Go to my dashboard" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Hi Diana!" })).toBeVisible();
  await expectAccessible(page);

  // A visita feita não volta a abrir sozinha.
  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
});

test("a conta demo é partilhada: depois de outro visitante saltar a visita, o seguinte também começa por ela", async ({ page }) => {
  await loginAs(page, "student");
  expect((await page.request.post("/api/tour/skip", { data: {} })).ok()).toBe(true);
  await page.context().clearCookies();

  await page.goto("/");
  await page.getByRole("button", { name: "Explore as a student" }).click();
  await expect(page).toHaveURL(/\/app\/tour$/);
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
  ["/app/contacts", "Your team"],
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
    const question = page.getByRole("button", { name: "What if I'm late on the first day?" });
    await expect(question).toBeVisible({ timeout: 15_000 });
    await question.focus();
    await page.keyboard.press("Enter");
    await expect(question).toHaveAttribute("aria-pressed", "true");
    // A meio da escrita da resposta o botão continua visível e com o foco.
    await expect(question).toBeFocused();
    await expect(question).toBeVisible();
    await expect(page.getByText(/Come in anyway and tell reception/).filter({ visible: true }).first()).toBeVisible();
    await expect(question).toBeFocused();
  });
});

test("um refetch falhado não troca a lista de tarefas por um erro", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/app/tasks");
  const task = page.getByRole("checkbox", { name: /Join the cohort chat and say hi/ });
  await expect(task).not.toBeChecked();

  // A lista passa a falhar (o PATCH não): o refetch depois de marcar dá 500 nas três tentativas.
  let failed = 0;
  await page.route(/\/api\/tasks$/, (route) => {
    failed++;
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Boom" }) });
  });
  await task.click();
  await expect.poll(() => failed, { timeout: 15_000 }).toBe(3);
  // Sem sinal no ecrã quando corre bem: dá tempo ao erro para aparecer, se fosse aparecer.
  await page.waitForTimeout(500);
  await expect(page.getByText("Couldn't load this")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Done/ })).toBeVisible();
});

test("errar a password no login de staff não tira a sessão de aluno", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/login/staff");
  await page.getByLabel("Email").fill("staff@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();

  // Sem recarregar: a sessão em cache continua lá e o Welcome reconhece o aluno.
  await page.getByRole("link", { name: "Kampus, go to the welcome page" }).click();
  await expect(page.getByRole("link", { name: /^Continue as/ })).toBeVisible();
});

test("se marcar uma tarefa falha, a caixa volta ao que estava", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/app/tasks");
  const task = page.getByRole("checkbox", { name: /Join the cohort chat and say hi/ });
  await expect(task).not.toBeChecked();

  // O PATCH falha, e a lista também: se ela respondesse, o refetch repunha a caixa e o
  // rollback do update otimista não era posto à prova.
  await page.route(/\/api\/tasks(\/[^/]+)?$/, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Boom" }) }));
  await task.click();
  await expect(page.getByText("Couldn't update the task").first()).toBeVisible();
  await expect(task).not.toBeChecked();
});

test("com a sessão caída a meio, o pedido seguinte leva ao login com o aviso", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/app/tasks");
  const task = page.getByRole("checkbox", { name: /Join the cohort chat and say hi/ });
  await expect(task).not.toBeChecked();

  // A sessão acaba no servidor sem a app saber: o PATCH seguinte responde 401.
  // Com o header Origin: sem ele, a proteção de CSRF recusa um POST sem corpo.
  expect((await page.request.post("/api/auth/logout", { headers: { origin: new URL(page.url()).origin } })).status()).toBe(204);
  await task.click();
  await expect(page).toHaveURL(/\/login\/student$/);
  await expect(page.getByText("Please log in to continue.")).toBeVisible();
});
