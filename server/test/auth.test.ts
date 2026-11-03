import type { PublicUser, WrongPortalError } from "@kampus/shared";
import { eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readSession } from "../src/auth/session.ts";
import { sessions } from "../src/db/schema.ts";
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
  // As páginas públicas perguntam sempre quem está ligado: sem sessão não é um erro.
  it("/auth/me sem cookie dá 200 com user null (não 401)", async () => {
    const res = await t.request("GET", "/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ user: null });
  });

  it("/auth/me com cookie inventado dá 200 com user null", async () => {
    const res = await t.request("GET", "/api/auth/me", { cookie: "kampus_session=invented" });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ user: null });
  });

  it("as outras rotas continuam a dar 401 sem sessão (é assim que o client sabe que a sessão caiu)", async () => {
    expect((await t.request("GET", "/api/tasks", { cookie: "kampus_session=invented" })).status).toBe(401);
    expect((await t.request("POST", "/api/auth/logout")).status).toBe(401);
  });

  it("logout invalida a sessão no servidor (o mesmo cookie deixa de servir)", async () => {
    const cookie = await t.login(STUDENT_A, "student");
    expect((await t.request<{ user: PublicUser }>("GET", "/api/auth/me", { cookie })).json.user.email).toBe(STUDENT_A);
    expect((await t.request("POST", "/api/auth/logout", { cookie })).status).toBe(204);
    expect((await t.request("GET", "/api/auth/me", { cookie })).json).toEqual({ user: null });
  });
});

describe("sessões na base", () => {
  it("a sessão lida em cada pedido não traz o hash da password", async () => {
    const cookie = await t.login(STUDENT_A, "student");
    const probe = new Hono().get("/", async (c) => {
      const session = await readSession(t.db, c);
      return c.json({ keys: Object.keys(session?.user ?? {}) });
    });
    const { keys } = (await (await probe.request("/", { headers: { cookie } })).json()) as { keys: string[] };
    expect(keys).toEqual(expect.arrayContaining(["id", "email", "role", "cohortId"]));
    expect(keys).not.toContain("passwordHash");
  });

  it("um login apaga as sessões já expiradas (de qualquer utilizador)", async () => {
    const userId = await t.userId("rui.matos@example.com");
    await t.db.insert(sessions).values({ id: "expired-session-for-test", userId, expiresAt: new Date(Date.now() - 60_000) });
    await t.login(STUDENT_A, "student");
    const left = await t.db.select().from(sessions).where(eq(sessions.id, "expired-session-for-test"));
    expect(left).toHaveLength(0);
    // As válidas ficam.
    const valid = await t.db.select().from(sessions).where(gt(sessions.expiresAt, new Date()));
    expect(valid.length).toBeGreaterThan(0);
  });
});

describe("mudar password", () => {
  it("recusa a password atual errada", async () => {
    const cookie = await t.login("rui.matos@example.com", "staff");
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
    expect((await t.request<{ user: PublicUser }>("GET", "/api/auth/me", { cookie: laptop })).json.user.email).toBe(email);
    expect((await t.request("GET", "/api/auth/me", { cookie: phone })).json).toEqual({ user: null });

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

  it("num preview da Vercel (origem fora do CORS_ORIGIN) o login e o logout funcionam", async () => {
    // O preview tem outro endereço e o CORS_ORIGIN só existe em produção. O csrf() do Hono só
    // trava pedidos com aspeto de formulário: o login vai em JSON, e um POST sem corpo passa
    // porque o browser diz que é da mesma origem (Sec-Fetch-Site).
    const preview = "https://kampus-reimagined-git-feat-davidvluccas-projects.vercel.app";
    const login = await t.app.request(`${preview}/api/auth/login`, {
      method: "POST",
      headers: { origin: preview, "sec-fetch-site": "same-origin", "content-type": "application/json" },
      body: JSON.stringify({ email: STUDENT_A, password: "Kampus123", portal: "student" }),
    });
    expect(login.status).toBe(200);
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0]!;
    const logout = await t.app.request(`${preview}/api/auth/logout`, {
      method: "POST",
      headers: { origin: preview, "sec-fetch-site": "same-origin", cookie },
    });
    expect(logout.status).toBe(204);
  });

  it("um POST sem corpo de outro site continua barrado", async () => {
    const res = await t.app.request("/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(res.status).toBe(403);
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
