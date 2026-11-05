import { expect, test } from "@playwright/test";
import { expectAccessible, loginAs, resetDemo } from "./helpers.ts";

const TITLE = "Bring your laptop charger on Monday";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("o staff dá uma tarefa à turma, o aluno marca-a como feita e o staff vê o progresso", async ({ browser }) => {
  // Staff: cria a tarefa para Web Dev.
  // Dois contextos (duas sessões) ao mesmo tempo: o staff e o aluno.
  const staff = await (await browser.newContext()).newPage();
  await loginAs(staff, "staff");
  await staff.goto("/staff/assignments");
  await expect(staff.getByRole("heading", { level: 1, name: "Cohort tasks" })).toBeVisible();
  await expectAccessible(staff);

  await staff.getByRole("button", { name: "New task" }).first().click();
  const dialog = staff.getByRole("dialog", { name: "New cohort task" });
  await expect(dialog.getByLabel("Cohort").locator("option")).toHaveCount(4);
  await dialog.getByLabel("Cohort").selectOption({ label: "Web Dev Oct 2026" });
  await dialog.getByLabel("Title").fill(TITLE);
  await expectAccessible(staff);
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();

  // A página passa para a turma da tarefa nova (abre na turma que começa a seguir).
  await expect(staff).toHaveURL(/[?&]cohort=/);
  const card = staff.getByRole("article", { name: TITLE });
  await expect(card).toContainText("0/8");

  // Aluno (Web Dev): vê a tarefa com o autor, sem editar nem apagar, e marca-a.
  const student = await (await browser.newContext()).newPage();
  await loginAs(student, "student");
  await student.goto("/app/tasks");
  const task = student.getByRole("checkbox", { name: new RegExp(TITLE) });
  await expect(task).toBeVisible();
  await expect(student.getByText(/From Marta Lopes/).first()).toBeVisible();
  await expect(student.getByRole("button", { name: `Edit "${TITLE}"` })).toHaveCount(0);
  await expect(student.getByRole("button", { name: `Delete "${TITLE}"` })).toHaveCount(0);
  // Espera pela resposta da API (a caixa muda logo, de forma otimista).
  const saved = student.waitForResponse((r) => r.url().includes("/api/tasks/") && r.request().method() === "PATCH");
  await task.click();
  expect((await saved).ok()).toBe(true);
  // Feita, passa para o grupo "Done", que começa fechado.
  await student.getByRole("button", { name: /^Done/ }).click();
  await expect(task).toBeChecked();
  await expectAccessible(student);

  // A API recusa editar a tarefa da turma.
  const list = (await (await student.request.get("/api/tasks")).json()) as { tasks: { id: string; title: string }[] };
  const id = list.tasks.find((t) => t.title === TITLE)!.id;
  expect((await student.request.patch(`/api/tasks/${id}`, { data: { title: "Hacked" } })).status()).toBe(403);

  // Staff: o progresso mudou, a Diana aparece como feita e sai do email de lembrete.
  await staff.reload();
  const updated = staff.getByRole("article", { name: TITLE });
  await expect(updated).toContainText("1/8");
  const remind = updated.getByRole("link", { name: `Email the 7 who haven't done it: "${TITLE}"` });
  await expect(remind).toHaveAttribute("href", /^mailto:\?bcc=/);
  expect(await remind.getAttribute("href")).not.toContain("student%40example.com");
  await updated.getByRole("button", { name: `See who has done "${TITLE}"` }).click();
  await expect(staff.getByRole("heading", { name: `7 haven't done "${TITLE}"` })).toBeVisible();
  await staff.getByRole("button", { name: "1 student did it" }).click();
  const doneList = staff.getByRole("list", { name: `Students who have done "${TITLE}"` });
  await expect(doneList.getByRole("listitem").filter({ hasText: "Diana Costa" })).toContainText("Done");
  await expectAccessible(staff);

  // Apagar tira-a da lista do aluno.
  await staff.getByRole("button", { name: `Delete "${TITLE}"` }).click();
  await staff.getByRole("alertdialog").getByRole("button", { name: /delete/i }).click();
  // O título do cartão (não o toast, que também tem o título).
  await expect(staff.getByRole("heading", { name: TITLE })).toHaveCount(0);
  await student.reload();
  // Com o "Done" aberto: fechado, a caixa nunca estaria lá e o teste passava sempre.
  await student.getByRole("button", { name: /^Done/ }).click();
  await expect(student.getByRole("checkbox", { name: new RegExp(TITLE) })).toHaveCount(0);

  await staff.context().close();
  await student.context().close();
});
