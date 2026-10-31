import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_CRON_SECRET } from "./env.ts";

/** Repõe a demo (o mesmo que o cron diário faz em produção). */
export async function resetDemo(request: APIRequestContext) {
  const res = await request.get("/api/cron/reset-demo", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Entra pela API (mais rápido que o formulário) com o cookie no contexto da página. */
export async function loginAs(page: Page, portal: "student" | "staff") {
  const res = await page.request.post("/api/auth/login", {
    data: { email: `${portal}@example.com`, password: "Kampus123", portal },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Falha com a lista de problemas de acessibilidade WCAG 2.1 A/AA que o axe encontrar. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const problems = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(problems).toEqual([]);
}
