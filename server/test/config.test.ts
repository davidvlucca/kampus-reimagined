import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp, describeError, parseSessionTtlDays } from "../src/app.ts";
import { attemptKey } from "../src/auth/rateLimit.ts";
import { createDb } from "../src/db/client.ts";
import { createPool } from "../src/db/postgres.ts";

describe("SESSION_TTL_DAYS", () => {
  it("aceita um número positivo", () => {
    expect(parseSessionTtlDays("7")).toBe(7);
    expect(parseSessionTtlDays("30")).toBe(30);
    expect(parseSessionTtlDays("0.5")).toBe(0.5);
  });

  it.each([undefined, "", "  ", "0", "-3", "abc", "NaN", "Infinity", "1e9"])("%j volta aos 7 dias", (value) => {
    expect(parseSessionTtlDays(value)).toBe(7);
  });
});

describe("erros 500 no log", () => {
  // Uma base sem migrações: a primeira query do login rebenta com um erro do Drizzle.
  let handle: ReturnType<typeof createDb>;
  beforeAll(() => {
    handle = createDb({ pgliteDir: "memory" });
  });
  afterAll(() => handle.close());

  it("não escreve os parâmetros da query (emails, hashes), só a mensagem, o código e a rota", async () => {
    const app = createApp({ db: handle.db, corsOrigins: [], session: { ttlDays: 7, secureCookies: false } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "leak@example.com", password: "secret-password", portal: "student" }),
    });
    const logged = JSON.stringify(error.mock.calls);
    error.mockRestore();

    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(logged).toContain("POST /api/auth/login");
    expect(logged).toContain("Failed query");
    // 42P01: a tabela não existe.
    expect(logged).toContain("42P01");
    expect(logged).not.toContain("params");
    expect(logged).not.toContain(attemptKey("leak@example.com", "unknown"));
    expect(logged).not.toContain("secret-password");
  });

  it("describeError corta os parâmetros da mensagem e não leva o objeto do erro", () => {
    const cause = Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), { code: "23505" });
    const err = new Error("Failed query: insert into users values ($1, $2)\nparams: a@b.com,$argon2id$v=19$m=19456$abc", { cause });
    const out = describeError(err, "POST /api/staff/students");
    expect(out).toMatchObject({
      route: "POST /api/staff/students",
      message: "Failed query: insert into users values ($1, $2)",
      code: "23505",
      cause: 'Error: duplicate key value violates unique constraint "users_email_unique"',
    });
    expect(JSON.stringify(out)).not.toMatch(/argon2|a@b\.com/);
  });
});

describe("pool do Postgres", () => {
  it("tem um listener de 'error': uma ligação parada que cai não derruba o processo", async () => {
    // O pool só liga à base na primeira query: aqui não chega a ligar.
    const pool = createPool("postgres://user:pass@127.0.0.1:1/kampus");
    expect(pool.listenerCount("error")).toBe(1);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => pool.emit("error", Object.assign(new Error("Connection terminated unexpectedly"), { code: "57P01" }))).not.toThrow();
    expect(error).toHaveBeenCalledWith("Postgres pool error", { message: "Connection terminated unexpectedly", code: "57P01" });
    error.mockRestore();
    await pool.end();
  });
});
