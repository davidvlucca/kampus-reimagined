import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { createDb } from "../src/db/client.ts";
import { seedDatabase } from "../src/demo-data.ts";

const SECRET = "test-cron-secret";
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  handle = createDb({ pgliteDir: "memory" });
  await handle.migrate();
  await seedDatabase(handle.db, { today: "2026-11-02" });
});
afterAll(() => handle.close());

const appWith = (cronSecret?: string) =>
  createApp({ db: handle.db, corsOrigins: [], session: { ttlDays: 7, secureCookies: false }, cronSecret });

describe("reposição diária da demo (Vercel Cron)", () => {
  it("sem CRON_SECRET configurado a rota não existe", async () => {
    expect((await appWith().request("/api/cron/reset-demo")).status).toBe(404);
  });

  it("recusa sem o segredo certo", async () => {
    const app = appWith(SECRET);
    expect((await app.request("/api/cron/reset-demo")).status).toBe(401);
    expect((await app.request("/api/cron/reset-demo", { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
  });

  it("com o segredo certo repõe os dados de demonstração", async () => {
    const app = appWith(SECRET);
    const res = await app.request("/api/cron/reset-demo", { headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, staff: 5, students: 20, cohorts: 3, assignments: 9 });
  });
});
