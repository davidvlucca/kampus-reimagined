import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import type { DbHandle } from "../src/db/client.ts";
import { notes, users } from "../src/db/schema.ts";
import { resetDemo, seedDatabase } from "../src/demo-data.ts";
import { createTestDb, realPostgres } from "./helpers.ts";

const SECRET = "test-cron-secret-with-at-least-32-chars";
let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
  await handle.migrate();
  await seedDatabase(handle.db, { today: "2026-11-02" });
});
afterAll(() => handle.close());

const appWith = (cronSecret?: string) =>
  createApp({ db: handle.db, corsOrigins: [], session: { ttlDays: 7, secureCookies: false }, cronSecret });

const count = async (table: typeof users | typeof notes) => {
  const [row] = await handle.db.select({ n: sql<number>`count(*)::int` }).from(table);
  return row!.n;
};

describe("reposição diária da demo (Vercel Cron)", () => {
  it("sem CRON_SECRET configurado a rota não existe", async () => {
    expect((await appWith().request("/api/cron/reset-demo")).status).toBe(404);
  });

  it("um CRON_SECRET com menos de 32 caracteres não liga a rota (e avisa no log)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const short = "short-secret";
    const app = appWith(short);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/CRON_SECRET is shorter than 32/));
    warn.mockRestore();
    expect((await app.request("/api/cron/reset-demo", { headers: { authorization: `Bearer ${short}` } })).status).toBe(404);
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

  it("se o seed falhar a meio, nada se perde: o TRUNCATE é desfeito", async () => {
    const before = { users: await count(users), notes: await count(notes) };
    // Uma data impossível faz o seed rebentar já depois do TRUNCATE.
    await expect(resetDemo(handle.db, { today: "not-a-date" })).rejects.toThrow();
    expect({ users: await count(users), notes: await count(notes) }).toEqual(before);
  });

  it("duas reposições ao mesmo tempo não se misturam (ficam os dados de uma só)", async () => {
    const results = await Promise.all([resetDemo(handle.db), resetDemo(handle.db)]);
    expect(results).toEqual([expect.objectContaining({ students: 20 }), expect.objectContaining({ students: 20 })]);
    expect(await count(users)).toBe(25);
  });

  // Em PGlite há uma só ligação: quem segura o lock bloqueava a própria base.
  it.skipIf(!realPostgres)("dois pedidos ao cron em paralelo esperam pelo lock de quem já está a repor", async () => {
    const app = appWith(SECRET);
    const cron = async () => app.request("/api/cron/reset-demo", { headers: { authorization: `Bearer ${SECRET}` } });
    let locked!: () => void;
    const isLocked = new Promise<void>((resolve) => (locked = resolve));
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    // Outra ligação fica com o lock, como uma reposição a meio.
    const holder = handle.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kampus:reset-demo'))`);
      locked();
      await released;
    });
    await isLocked;
    let finished = 0;
    const requests = [cron(), cron()].map((p) => p.then((res) => (finished++, res)));
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(finished).toBe(0);
    } finally {
      // Sempre: com o lock preso, o close() no fim nunca chegava a apagar a base.
      release();
      await holder;
    }
    expect((await Promise.all(requests)).map((res) => res.status)).toEqual([200, 200]);
    expect(await count(users)).toBe(25);
  });
});
