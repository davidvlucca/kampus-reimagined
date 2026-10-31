import type { PublicUser, WrongPortalError } from "@kampus/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup, STAFF, STUDENT_A } from "./helpers.ts";

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  t = await setup();
});
afterAll(() => t.close());

describe("login", () => {
  it("entra com email e password certos e devolve o utilizador sem hash", async () => {
    const res = await t.request<{ user: PublicUser }>("POST", "/api/auth/login", {
      body: { email: STUDENT_A, password: "Kampus123", portal: "student" },
    });
    expect(res.status).toBe(200);
    expect(res.json.user.email).toBe(STUDENT_A);
    expect(res.json.user.role).toBe("student");
    expect(res.text).not.toMatch(/password|argon2/i);
  });

  it("o email não distingue maiúsculas", async () => {
    const res = await t.request("POST", "/api/auth/login", {
      body: { email: "  Student@Example.com ", password: "Kampus123", portal: "student" },
    });
    expect(res.status).toBe(200);
  });

  it("o cookie de sessão é httpOnly e SameSite=Lax", async () => {
    const res = await t.request("POST", "/api/auth/login", {
      body: { email: STAFF, password: "Kampus123", portal: "staff" },
    });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^kampus_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("password errada dá 401 genérico", async () => {
    const res = await t.request("POST", "/api/auth/login", {
      body: { email: STUDENT_A, password: "wrong-password", portal: "student" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Wrong email or password." });
  });

  it("email inexistente e portal errado com password errada dão EXATAMENTE a mesma resposta", async () => {
    const unknownEmail = await t.request("POST", "/api/auth/login", {
      body: { email: "nobody@example.com", password: "wrong-password", portal: "staff" },
    });
    const wrongPortalWrongPassword = await t.request("POST", "/api/auth/login", {
      body: { email: STUDENT_A, password: "wrong-password", portal: "staff" },
    });
    expect(unknownEmail.status).toBe(401);
    expect(wrongPortalWrongPassword.status).toBe(unknownEmail.status);
    expect(wrongPortalWrongPassword.text).toBe(unknownEmail.text);
    expect(wrongPortalWrongPassword.headers.get("set-cookie")).toBeNull();
  });

  it("só com a password certa é que o portal errado dá 403 com o portal correto", async () => {
    const res = await t.request<WrongPortalError>("POST", "/api/auth/login", {
      body: { email: STUDENT_A, password: "Kampus123", portal: "staff" },
    });
    expect(res.status).toBe(403);
    expect(res.json.correctPortal).toBe("student");
    expect(res.headers.get("set-cookie")).toBeNull();

    const staff = await t.request<WrongPortalError>("POST", "/api/auth/login", {
      body: { email: STAFF, password: "Kampus123", portal: "student" },
    });
    expect(staff.status).toBe(403);
    expect(staff.json.correctPortal).toBe("staff");
  });

  it("valida o corpo com Zod (400 com campos)", async () => {
    const res = await t.request<{ fields: Record<string, string> }>("POST", "/api/auth/login", {
      body: { email: "not-an-email", password: "", portal: "admin" },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.json.fields)).toEqual(expect.arrayContaining(["email", "password", "portal"]));
  });
});

describe("sessão", () => {
  it("/auth/me sem cookie dá 401", async () => {
    expect((await t.request("GET", "/api/auth/me")).status).toBe(401);
  });

  it("/auth/me com cookie inventado dá 401", async () => {
    expect((await t.request("GET", "/api/auth/me", { cookie: "kampus_session=invented" })).status).toBe(401);
  });

  it("logout invalida a sessão no servidor (o mesmo cookie deixa de servir)", async () => {
    const cookie = await t.login(STUDENT_A, "student");
    expect((await t.request("GET", "/api/auth/me", { cookie })).status).toBe(200);
    expect((await t.request("POST", "/api/auth/logout", { cookie })).status).toBe(204);
    expect((await t.request("GET", "/api/auth/me", { cookie })).status).toBe(401);
  });
});

describe("mudar password", () => {
  it("recusa a password atual errada", async () => {
    const cookie = await t.login(STAFF, "staff");
    const res = await t.request("POST", "/api/me/password", {
      cookie,
      body: { currentPassword: "nope", newPassword: "NewPassword1" },
    });
    expect(res.status).toBe(400);
  });

  it("muda a password e termina as outras sessões", async () => {
    const email = "elena.varga@example.com";
    const laptop = await t.login(email, "student");
    const phone = await t.login(email, "student");

    const res = await t.request("POST", "/api/me/password", {
      cookie: laptop,
      body: { currentPassword: "Kampus123", newPassword: "NewPassword1" },
    });
    expect(res.status).toBe(204);
    expect((await t.request("GET", "/api/auth/me", { cookie: laptop })).status).toBe(200);
    expect((await t.request("GET", "/api/auth/me", { cookie: phone })).status).toBe(401);

    const old = await t.request("POST", "/api/auth/login", { body: { email, password: "Kampus123", portal: "student" } });
    expect(old.status).toBe(401);
    await t.login(email, "student", "NewPassword1");
  });
});

describe("CORS", () => {
  it("responde com Access-Control-Allow-Origin só para a origem configurada", async () => {
    const ok = await t.request("GET", "/api/health");
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");

    const evil = await t.request("GET", "/api/health", { origin: "https://evil.example" });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("bloqueia um formulário enviado de outro site (CSRF)", async () => {
    const res = await t.app.request("/api/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
      body: "email=student%40example.com&password=Kampus123&portal=student",
    });
    expect(res.status).toBe(403);
  });
});
