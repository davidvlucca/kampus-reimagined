import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { reauthAttemptKey } from "../src/auth/rateLimit.ts";
import { createSessionIfCurrent } from "../src/auth/session.ts";
import { loginAttempts, sessions, users } from "../src/db/schema.ts";
import { setup, STAFF } from "./helpers.ts";

// Um gancho logo a seguir ao argon2 do login: deixa provocar, sempre no mesmo ponto, uma
// mudança de password entre a verificação e a criação da sessão. Conta também as verificações.
const hooks = vi.hoisted(() => ({ afterVerify: undefined as (() => Promise<void>) | undefined, verifyCalls: 0 }));
vi.mock("../src/auth/password.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth/password.ts")>();
  return {
    ...actual,
    verifyPassword: async (hash: string, password: string) => {
      hooks.verifyCalls++;
      const ok = await actual.verifyPassword(hash, password);
      const hook = hooks.afterVerify;
      hooks.afterVerify = undefined;
      if (hook) await hook();
      return ok;
    },
  };
});

let t: Awaited<ReturnType<typeof setup>>;
let staff: string;
beforeAll(async () => {
  t = await setup();
  staff = await t.login(STAFF, "staff");
});
beforeEach(() => {
  hooks.afterVerify = undefined;
  vi.restoreAllMocks();
});
afterAll(() => t.close());

const loginRequest = (email: string, password = "Kampus123") =>
  t.request("POST", "/api/auth/login", { body: { email, password, portal: "student" } });

async function sessionCount(userId: string) {
  const rows = await t.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  return rows.length;
}

async function passwordHashOf(userId: string) {
  const [row] = await t.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  return row!.passwordHash;
}

describe("login a meio de uma mudança de password", () => {
  it("uma reposição pelo staff entre o argon2 e a sessão: o login com a password antiga é recusado", async () => {
    const email = "beatriz.nunes@example.com";
    const id = await t.userId(email);
    hooks.afterVerify = async () => {
      const reset = await t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { password: "ResetPass1" } });
      expect(reset.status).toBe(200);
    };
    const res = await loginRequest(email);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Wrong email or password." });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await sessionCount(id)).toBe(0);
    await t.login(email, "student", "ResetPass1");
  });

  it("uma mudança pelo próprio entre o argon2 e a sessão: o login com a password antiga é recusado", async () => {
    const email = "carlos.mendes@example.com";
    const id = await t.userId(email);
    const laptop = await t.login(email, "student");
    hooks.afterVerify = async () => {
      const change = await t.request("POST", "/api/me/password", {
        cookie: laptop,
        body: { currentPassword: "Kampus123", newPassword: "NewPassword1" },
      });
      expect(change.status).toBe(204);
    };
    expect((await loginRequest(email)).status).toBe(401);
    // Fica só a sessão de quem mudou a password.
    expect(await sessionCount(id)).toBe(1);
    expect((await t.request("GET", "/api/auth/me", { cookie: laptop })).status).toBe(200);
  });

  it("createSessionIfCurrent com um hash já ultrapassado não cria sessão", async () => {
    const email = "filipe.gomes@example.com";
    const id = await t.userId(email);
    const staleHash = await passwordHashOf(id);
    expect((await t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { password: "ResetPass2" } })).status).toBe(200);
    const created = await createSessionIfCurrent(t.db, { id, passwordHash: staleHash, email }, { ttlDays: 7, secureCookies: false });
    expect(created).toBeNull();
    expect(await sessionCount(id)).toBe(0);
  });

  it("um email mudado pelo staff a meio também recusa o login com o email antigo", async () => {
    const email = "hana.sato@example.com";
    const id = await t.userId(email);
    hooks.afterVerify = async () => {
      expect((await t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { email: "hana.new@example.com" } })).status).toBe(200);
    };
    expect((await loginRequest(email)).status).toBe(401);
    expect(await sessionCount(id)).toBe(0);
  });
});

describe("mudar a password e terminar as sessões é uma só transação", () => {
  // Um trigger só nesta base de teste faz falhar o apagar das sessões de um utilizador.
  async function failSessionDeletesFor(userId: string) {
    await t.db.execute(sql`create or replace function test_fail_session_delete() returns trigger language plpgsql as $$
      begin raise exception 'falha simulada'; end $$`);
    await t.db.execute(
      sql.raw(`create trigger test_fail_session_delete before delete on sessions for each row
        when (old.user_id = '${userId}'::uuid) execute function test_fail_session_delete()`),
    );
  }
  const dropTrigger = () => t.db.execute(sql`drop trigger if exists test_fail_session_delete on sessions`);
  afterAll(dropTrigger);

  it("se apagar as sessões falha, a reposição pelo staff não muda a password", async () => {
    const email = "lucas.oliveira@example.com";
    const id = await t.userId(email);
    const before = await passwordHashOf(id);
    await t.login(email, "student");
    await failSessionDeletesFor(id);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { password: "ResetPass3" } });
    expect(res.status).toBe(500);
    await dropTrigger();
    expect(await passwordHashOf(id)).toBe(before);
    expect(await sessionCount(id)).toBe(1);
  });

  it("se apagar as outras sessões falha, a mudança pelo próprio não muda a password", async () => {
    const email = "mariana.teixeira@example.com";
    const id = await t.userId(email);
    const before = await passwordHashOf(id);
    const laptop = await t.login(email, "student");
    await t.login(email, "student");
    await failSessionDeletesFor(id);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await t.request("POST", "/api/me/password", {
      cookie: laptop,
      body: { currentPassword: "Kampus123", newPassword: "NewPassword1" },
    });
    expect(res.status).toBe(500);
    await dropTrigger();
    expect(await passwordHashOf(id)).toBe(before);
    expect(await sessionCount(id)).toBe(2);
  });

  it("uma reposição pelo staff a meio de uma mudança pelo próprio: ganha a do staff", async () => {
    const email = "nuno.barros@example.com";
    const id = await t.userId(email);
    const laptop = await t.login(email, "student");
    hooks.afterVerify = async () => {
      expect((await t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { password: "ResetPass4" } })).status).toBe(200);
    };
    const res = await t.request("POST", "/api/me/password", {
      cookie: laptop,
      body: { currentPassword: "Kampus123", newPassword: "NewPassword1" },
    });
    expect(res.status).toBe(400);
    expect((await loginRequest(email, "NewPassword1")).status).toBe(401);
    await t.login(email, "student", "ResetPass4");
  });

  it("um email mudado pelo staff a meio de uma mudança pelo próprio: a sessão já não vale", async () => {
    const email = "olivia.brown@example.com";
    const id = await t.userId(email);
    const before = await passwordHashOf(id);
    const laptop = await t.login(email, "student");
    hooks.afterVerify = async () => {
      expect((await t.request("PATCH", `/api/staff/students/${id}`, { cookie: staff, body: { email: "olivia.new@example.com" } })).status).toBe(200);
    };
    const res = await t.request("POST", "/api/me/password", {
      cookie: laptop,
      body: { currentPassword: "Kampus123", newPassword: "NewPassword1" },
    });
    expect(res.status).toBe(401);
    expect(await passwordHashOf(id)).toBe(before);
  });
});

describe("confirmar a password atual tem o limite do login", () => {
  const changePassword = (cookie: string, currentPassword: string) =>
    t.request<{ error: string }>("POST", "/api/me/password", { cookie, body: { currentPassword, newPassword: "NewPassword1" } });
  const reauthRows = async (userId: string) =>
    (await t.db.select().from(loginAttempts).where(eq(loginAttempts.key, reauthAttemptKey(userId)))).length;

  it("5 falhas dão 400; a 6.ª dá o 429 do login antes do argon2, mesmo com a password certa", async () => {
    const email = "pedro.faria@example.com";
    const id = await t.userId(email);
    const cookie = await t.login(email, "student");
    const before = hooks.verifyCalls;
    for (let i = 0; i < 5; i++) expect((await changePassword(cookie, "wrong")).status).toBe(400);
    expect(hooks.verifyCalls - before).toBe(5);
    expect(await reauthRows(id)).toBe(5);

    const blocked = await changePassword(cookie, "wrong");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.json).toEqual({ error: expect.stringMatching(/^Too many login attempts\. Try again in \d+ minutes?\.$/) });
    expect((await changePassword(cookie, "Kampus123")).status).toBe(429);
    // Nenhum dos barrados chegou ao argon2, nem ficou gravado.
    expect(hooks.verifyCalls - before).toBe(5);
    expect(await reauthRows(id)).toBe(5);
    expect((await loginRequest(email, "NewPassword1")).status).toBe(401);
  });

  it("uma confirmação certa não conta e apaga as falhas anteriores dessa conta", async () => {
    const email = "rita.moreira@example.com";
    const id = await t.userId(email);
    const cookie = await t.login(email, "student");
    for (let i = 0; i < 4; i++) expect((await changePassword(cookie, "wrong")).status).toBe(400);
    expect((await changePassword(cookie, "Kampus123")).status).toBe(204);
    expect(await reauthRows(id)).toBe(0);
    for (let i = 0; i < 4; i++) expect((await changePassword(cookie, "wrong")).status).toBe(400);
  });
});
