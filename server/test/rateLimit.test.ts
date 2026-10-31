import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { createDb } from "../src/db/client.ts";
import { loginAttempts } from "../src/db/schema.ts";
import { seedDatabase } from "../src/demo-data.ts";

let handle: ReturnType<typeof createDb>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  handle = createDb({ pgliteDir: "memory" });
  await handle.migrate();
  await seedDatabase(handle.db, { today: "2026-11-02" });
  // Como na Vercel: o IP vem do x-forwarded-for.
  app = createApp({ db: handle.db, corsOrigins: [], session: { ttlDays: 7, secureCookies: false }, trustProxy: true });
});
afterAll(() => handle.close());

const login = (email: string, password: string, ip: string) =>
  app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password, portal: "student" }),
  });

describe("limite de tentativas de login (5 por email+IP em 15 min)", () => {
  it("5 falhas dão 401; a 6.ª dá 429 com Retry-After, mesmo com a password certa", async () => {
    const ip = "203.0.113.1";
    for (let i = 0; i < 5; i++) expect((await login("student@example.com", "wrong", ip)).status).toBe(401);

    const blocked = await login("student@example.com", "wrong", ip);
    expect(blocked.status).toBe(429);
    const retryAfter = Number(blocked.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);
    expect((await blocked.json()) as { error: string }).toMatchObject({ error: expect.stringMatching(/Too many login attempts/) });

    expect((await login("student@example.com", "Kampus123", ip)).status).toBe(429);
  });

  it("o mesmo email noutro IP não fica bloqueado", async () => {
    expect((await login("student@example.com", "Kampus123", "198.51.100.7")).status).toBe(200);
  });

  it("emails inexistentes também contam (não há forma de testar emails à vontade)", async () => {
    const ip = "203.0.113.2";
    for (let i = 0; i < 5; i++) expect((await login("nobody@example.com", "x", ip)).status).toBe(401);
    expect((await login("nobody@example.com", "x", ip)).status).toBe(429);
  });

  it("passados 15 minutos volta a deixar entrar", async () => {
    const ip = "203.0.113.3";
    for (let i = 0; i < 5; i++) await login("andre.pinto@example.com", "wrong", ip);
    expect((await login("andre.pinto@example.com", "Kampus123", ip)).status).toBe(429);
    // Simula o tempo a passar: as falhas passam a ter 16 minutos.
    await handle.db.update(loginAttempts).set({ attemptedAt: sql`now() - interval '16 minutes'` });
    expect((await login("andre.pinto@example.com", "Kampus123", ip)).status).toBe(200);
  });

  it("um login certo apaga as falhas anteriores desse email+IP", async () => {
    const ip = "203.0.113.4";
    for (let i = 0; i < 4; i++) await login("beatriz.nunes@example.com", "wrong", ip);
    expect((await login("beatriz.nunes@example.com", "Kampus123", ip)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login("beatriz.nunes@example.com", "wrong", ip)).status).toBe(401);
  });

  it("não guarda o email nem o IP em claro", async () => {
    const rows = await handle.db.select().from(loginAttempts);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.key).toMatch(/^[0-9a-f]{64}$/);
      expect(row.key).not.toContain("@");
    }
  });
});
