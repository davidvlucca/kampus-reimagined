import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { createDb } from "../src/db/client.ts";
import { ipAttemptKey } from "../src/auth/rateLimit.ts";
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

describe("limite de tentativas de login (5 falhas por email+IP em 15 min)", () => {
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

  it("pedidos em paralelo não passam todos: no máximo 5 chegam à verificação da password", async () => {
    const ip = "203.0.113.5";
    const statuses = await Promise.all(Array.from({ length: 20 }, async () => (await login("carlos.mendes@example.com", "wrong", ip)).status));
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(15);
    expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
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

describe("limite por IP (30 tentativas em 15 min, seja qual for o email)", () => {
  it("emails sempre diferentes não escapam ao limite: a 31.ª tentativa dá 429, mesmo a certa", async () => {
    const ip = "198.51.100.20";
    for (let i = 0; i < 30; i++) expect((await login(`nobody${i}@example.com`, "x", ip)).status).toBe(401);

    const blocked = await login("nobody-else@example.com", "x", ip);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await login("elena.varga@example.com", "Kampus123", ip)).status).toBe(429);

    // Outro IP continua a poder entrar.
    expect((await login("elena.varga@example.com", "Kampus123", "198.51.100.21")).status).toBe(200);
  });

  it("os logins certos também contam (a password da demo é pública)", async () => {
    const ip = "198.51.100.22";
    for (let i = 0; i < 30; i++) expect((await login("filipe.gomes@example.com", "Kampus123", ip)).status).toBe(200);
    expect((await login("filipe.gomes@example.com", "Kampus123", ip)).status).toBe(429);
  });

  it("200 pedidos em paralelo com emails diferentes: no máximo 30 chegam ao argon2", async () => {
    const ip = "198.51.100.23";
    const statuses = await Promise.all(
      Array.from({ length: 200 }, async (_, i) => (await login(`burst${i}@example.com`, "x", ip)).status),
    );
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(30);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(170);
  });

  it("as tentativas barradas não ficam gravadas", async () => {
    // Do teste anterior: só as que passaram (<= 30) ficaram, não as 200.
    const rows = await handle.db.select().from(loginAttempts).where(sql`${loginAttempts.key} = ${ipAttemptKey("198.51.100.23")}`);
    expect(rows.length).toBeLessThanOrEqual(30);
  });
});
