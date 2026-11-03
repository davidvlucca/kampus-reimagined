import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
