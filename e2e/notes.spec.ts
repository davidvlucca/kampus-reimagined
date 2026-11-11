import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, loginAs, resetDemo } from "./helpers.ts";

// O editor de notas (guardar automático, rascunho, aviso ao sair). No telemóvel a lista e o editor
// são ecrãs separados; em desktop estão lado a lado. A demo tem 3 notas do aluno.
const DAY1 = "Day 1: welcome session";
const QUESTIONS = "Questions for the TA";
const IDEAS = "Ideas for the first project";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

type ApiNote = { id: string; title: string; body: string };

const apiNotes = async (page: Page) => ((await (await page.request.get("/api/notes")).json()) as { notes: ApiNote[] }).notes;
const apiNote = async (page: Page, id: string) => ((await (await page.request.get(`/api/notes/${id}`)).json()) as { note: ApiNote }).note;
const noteIdOf = async (page: Page, title: string) => (await apiNotes(page)).find((n) => n.title === title)!.id;

// Há dois "Saved" no DOM (um por ecrã, só um visível): conta o visível.
const saved = (page: Page) => page.getByText("Saved", { exact: true }).filter({ visible: true });
const titleField = (page: Page) => page.getByRole("textbox", { name: "Title" });
const bodyField = (page: Page) => page.getByRole("textbox", { name: "Note", exact: true });

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

/** Cria uma nota nova (o editor abre logo, com o título selecionado). */
async function newNote(page: Page) {
  await page.goto("/app/notes");
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page).toHaveURL(/\/app\/notes\/[0-9a-f-]{36}$/);
  await expect(titleField(page)).toHaveValue("Untitled note");
  return page.url().split("/").pop()!;
}

/** Sai do editor por navegação dentro da app (sem recarregar): no telemóvel pelo "All notes", em desktop por outra nota da lista. */
async function leaveEditor(page: Page, other: string) {
  if (isMobile(page)) await page.getByRole("link", { name: "All notes" }).click();
  else await page.getByRole("link", { name: new RegExp(`^${other}`) }).click();
}

test("escrever título e corpo guarda sozinho, e o texto sobrevive a recarregar e aparece na lista", async ({ page }) => {
  await loginAs(page, "student");
  const id = await newNote(page);

  await titleField(page).fill("Locker 214");
  await bodyField(page).fill("Combination: 12-34-56\nAsk the Campus Manager for a spare key.");
  // Escrever deixa a nota por guardar ("Saving…") até o guardar automático correr.
  await expect(page.getByText("Saving…").filter({ visible: true })).toBeVisible();
  await expect(saved(page)).toBeVisible();
  await expect.poll(async () => (await apiNote(page, id)).body).toBe("Combination: 12-34-56\nAsk the Campus Manager for a spare key.");

  await page.reload();
  await expect(titleField(page)).toHaveValue("Locker 214");
  await expect(bodyField(page)).toHaveValue("Combination: 12-34-56\nAsk the Campus Manager for a spare key.");
  // Já estava guardado: sem aviso de texto reposto.
  await expect(page.getByText("Restored unsaved changes from earlier.")).toHaveCount(0);

  await page.goto("/app/notes");
  await expect(page.getByText("4 notes")).toBeVisible();
  await expect(page.getByRole("link", { name: /Locker 214/ })).toContainText("Combination: 12-34-56 Ask the Campus Manager for a spare key.");
});

test("um título com um tab no meio fica com espaço e chega a Saved", async ({ page }) => {
  await loginAs(page, "student");
  const id = await newNote(page);

  // Regressão: com o tab no estado, o título nunca batia certo com o gravado e ficava em "Saving…".
  await titleField(page).fill("Wifi\tpassword");
  await expect(titleField(page)).toHaveValue("Wifi password");
  await expect(saved(page)).toBeVisible();
  await expect(page.getByText("Saving…").filter({ visible: true })).toHaveCount(0);
  await expect.poll(async () => (await apiNote(page, id)).title).toBe("Wifi password");
});

test("se guardar falha mostra o erro com Try again, o texto volta depois de recarregar e guarda quando a API volta", async ({ page }) => {
  await loginAs(page, "student");
  const id = await noteIdOf(page, IDEAS);
  // Só o PATCH falha: abrir e ler a nota continua a funcionar.
  const failSaves = async () =>
    page.route("**/api/notes/*", (route) =>
      route.request().method() === "PATCH" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Boom" }) }) : route.fallback(),
    );
  await failSaves();
  // Recarregar com texto por guardar pode abrir o aviso do browser.
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto(`/app/notes/${id}`);
  await bodyField(page).fill("Seat 14B, ask Marta for the key.");
  await expect(page.getByText("Couldn't save", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expectAccessible(page);

  // O texto não se perde: o rascunho volta, mas só se guarda quando o aluno decide.
  await page.reload();
  await expect(bodyField(page)).toHaveValue("Seat 14B, ask Marta for the key.");
  await expect(page.getByText("Restored unsaved changes from earlier.")).toBeVisible();
  await expect(page.getByText("Not saved yet").filter({ visible: true })).toBeVisible();
  // Na API continua o texto antigo.
  expect((await apiNote(page, id)).body).toContain("Something useful");

  // "Keep them" tenta guardar e, com a API ainda a falhar, volta ao erro.
  await page.getByRole("button", { name: "Keep them" }).click();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  // A API volta ao normal: "Try again" guarda.
  await page.unroute("**/api/notes/*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(saved(page)).toBeVisible();
  await expect.poll(async () => (await apiNote(page, id)).body).toBe("Seat 14B, ask Marta for the key.");
});

test("abrir uma nota nova e sair sem escrever apaga-a: não fica na lista", async ({ page }) => {
  await loginAs(page, "student");
  const id = await newNote(page);
  expect(await apiNotes(page)).toHaveLength(4);

  await leaveEditor(page, DAY1);
  await expect(page.getByText("3 notes")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Untitled note/ })).toHaveCount(0);
  await expect.poll(async () => (await apiNotes(page)).some((n) => n.id === id)).toBe(false);
});

test("a mesma nota noutro separador sem alterações passa a mostrar o texto guardado no primeiro", async ({ context }) => {
  const a = await context.newPage();
  await loginAs(a, "student");
  const id = await noteIdOf(a, QUESTIONS);
  const b = await context.newPage();

  await a.goto(`/app/notes/${id}`);
  await b.goto(`/app/notes/${id}`);
  await expect(titleField(b)).toHaveValue(QUESTIONS);

  await titleField(a).fill("Questions for the TA (answered)");
  await bodyField(a).fill("- Ask in the lab chat first.\n- Hand in exercises on the portal.");
  await expect(saved(a)).toBeVisible();
  await expect.poll(async () => (await apiNote(a, id)).title).toBe("Questions for the TA (answered)");
  await expect.poll(async () => (await apiNote(a, id)).body).toBe("- Ask in the lab chat first.\n- Hand in exercises on the portal.");

  // Não há refetch ao focar (refetchOnWindowFocus: false) nem polling: o B só vê a nota nova quando
  // a volta a abrir dentro da app (mostra a cache e o refetch da montagem atualiza o formulário).
  await leaveEditor(b, DAY1);
  await b.getByRole("link", { name: new RegExp(`^${QUESTIONS}`) }).click();
  await expect(titleField(b)).toHaveValue("Questions for the TA (answered)");
  await expect(bodyField(b)).toHaveValue("- Ask in the lab chat first.\n- Hand in exercises on the portal.");
  await expect(saved(b)).toBeVisible();
  // O B não tinha nada por guardar: nem voltou a guardar nem mostra rascunho reposto.
  await expect(b.getByText("Restored unsaved changes from earlier.")).toHaveCount(0);
});

test("o editor aberto com uma nota é acessível", async ({ page }) => {
  await loginAs(page, "student");
  const id = await noteIdOf(page, DAY1);
  await page.goto(`/app/notes/${id}`);
  await expect(titleField(page)).toHaveValue(DAY1);
  await expect(saved(page)).toBeVisible();
  await expectAccessible(page);
});
