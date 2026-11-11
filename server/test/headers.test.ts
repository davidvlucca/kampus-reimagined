import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { appVersion } from "../src/config.ts";
import type { Db } from "../src/db/client.ts";
import { setup, STUDENT_A } from "./helpers.ts";

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  t = await setup();
});
afterAll(() => t.close());

describe("headers de segurança da API", () => {
  it.each(["/api/health", "/api/auth/me", "/api/tasks", "/api/nope"])("%s leva HSTS de 2 anos, X-Frame-Options DENY e uma CSP fechada", async (path) => {
    const res = await t.request("GET", path);
    expect(res.headers.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains; preload");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("Cache-Control da API", () => {
  it("as respostas com dados da sessão não ficam em cache", async () => {
    const cookie = await t.login(STUDENT_A, "student");
    for (const path of ["/api/auth/me", "/api/tasks", "/api/notes", "/api/contacts"]) {
      const res = await t.request("GET", path, { cookie });
      expect(res.status, path).toBe(200);
      expect(res.headers.get("cache-control"), path).toBe("no-store");
    }
  });

  it("erros (401, 404, 400) também levam no-store", async () => {
    expect((await t.request("GET", "/api/tasks")).headers.get("cache-control")).toBe("no-store");
    expect((await t.request("GET", "/api/nope")).headers.get("cache-control")).toBe("no-store");
    const bad = await t.request("POST", "/api/auth/login", { body: { email: "x" } });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("cache-control")).toBe("no-store");
  });

  it("o login (com Set-Cookie) não fica em cache", async () => {
    const res = await t.request("POST", "/api/auth/login", { body: { email: STUDENT_A, password: "Kampus123", portal: "student" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("/api/health", () => {
  it("responde ok, sem cache, com a versão", async () => {
    const res = await t.request<{ ok: boolean; version: string }>("GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, version: "dev" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("a versão é o commit curto da Vercel, ou dev", () => {
    expect(appVersion("4af7b6d1c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7")).toBe("4af7b6d");
    expect(appVersion(undefined)).toBe("dev");
    expect(appVersion("  ")).toBe("dev");
  });

  it("/api/health/ready dá 503 se falta aplicar uma migração do código (deploy antes de migrar a base)", async () => {
    const fresh = await setup();
    // Como uma base que ficou uma migração atrás do código.
    await fresh.db.execute(sql`delete from drizzle.__drizzle_migrations where created_at = (select max(created_at) from drizzle.__drizzle_migrations)`);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await fresh.request("GET", "/api/health/ready");
    const logged = JSON.stringify(error.mock.calls);
    error.mockRestore();
    await fresh.close();
    expect(res.status).toBe(503);
    expect(res.json).toEqual({ ok: false, reason: "migrations" });
    expect(logged).toContain("migrations pending");
  });

  it("/api/health/ready lê a base e confirma que tem as migrações do código", async () => {
    const res = await t.request<{ ok: boolean; version: string }>("GET", "/api/health/ready");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, version: "dev" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("/api/health/ready dá 503 se a base não responde, com o erro no log e não na resposta", async () => {
    const down = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
    const db = { execute: () => Promise.reject(down) } as unknown as Db;
    const app = createApp({ db, corsOrigins: [], session: { ttlDays: 7, secureCookies: false }, version: "abc1234" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("/api/health/ready");
    const logged = JSON.stringify(error.mock.calls);
    error.mockRestore();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(logged).toContain("GET /api/health/ready");
    expect(logged).toContain("ECONNREFUSED");
    // O /api/health (vivo) não depende da base.
    expect(await (await app.request("/api/health")).json()).toEqual({ ok: true, version: "abc1234" });
  });
});
