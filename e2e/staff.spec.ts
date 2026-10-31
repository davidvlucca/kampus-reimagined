import { expect, test } from "@playwright/test";
import { expectAccessible, loginAs, resetDemo } from "./helpers.ts";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("o staff entra com um clique, cria um aluno e apaga-o", async ({ page }) => {
  await page.goto("/login/staff");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Log in with demo account" }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole("heading", { name: "Hi Marta!" })).toBeVisible();
  await expectAccessible(page);

  await page.goto("/staff/students");
  await page.getByRole("button", { name: "Add student" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add student" });
  await dialog.getByLabel("First name").fill("Test");
  await dialog.getByLabel("Last name").fill("Student");
  await dialog.getByLabel("Email").fill("test.student@example.com");
  // Espera pelas turmas (vêm da API) antes de escolher uma.
  await expect(dialog.getByLabel("Cohort").locator("option")).toHaveCount(4);
  await dialog.getByLabel("Cohort").selectOption({ index: 1 });
  await dialog.getByLabel("Temporary password").fill("Welcome2026");
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Add student" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByText("test.student@example.com").filter({ visible: true });
  await expect(row).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("button", { name: /Delete Test Student/ }).filter({ visible: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete student" }).click();
  await expect(row).toBeHidden();
});

test("/staff/profile passa no axe", async ({ page }) => {
  await loginAs(page, "staff");
  await page.goto("/staff/profile");
  await expect(page.getByRole("heading", { level: 1, name: "Your profile" })).toBeVisible();
  await expectAccessible(page);
});
