import { randomBytes } from "node:crypto";
import { DEMO_PASSWORD } from "@kampus/shared";
import { eq } from "drizzle-orm";
import pg from "pg";
import { createApp } from "../src/app.ts";
import { createDb, type DbHandle } from "../src/db/client.ts";
import { users } from "../src/db/schema.ts";
import { seedDatabase } from "../src/demo-data.ts";

const ORIGIN = "http://localhost:5173";

/** Com TEST_DATABASE_URL os testes correm num Postgres a sério (npm run test:pg). */
export const realPostgres = Boolean(process.env.TEST_DATABASE_URL);

async function admin(url: string, query: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}

/**
 * A base de um ficheiro de testes, ainda por migrar. Sem TEST_DATABASE_URL é PGlite em memória
 * (uma só ligação). Com ele é uma base nova, só deste ficheiro, no Postgres indicado, com o pool
 * de produção (várias ligações): é aí que os locks e as corridas se veem. Fechar apaga a base.
 */
export async function createTestDb(): Promise<DbHandle> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return createDb({ pgliteDir: "memory" });
  const name = `kampus_test_${randomBytes(6).toString("hex")}`;
  await admin(url, `create database ${name}`);
  const dbUrl = new URL(url);
  dbUrl.pathname = `/${name}`;
  const handle = createDb({ databaseUrl: dbUrl.toString() });
  return {
    ...handle,
    close: async () => {
      await handle.close();
      await admin(url, `drop database if exists ${name} with (force)`);
    },
  };
}

/** Uma app com a base de testes (ver createTestDb), migrada e com o seed de demo. */
export async function setup() {
  const handle = await createTestDb();
  await handle.migrate();
  await seedDatabase(handle.db, { today: "2026-11-02" });
  const app = createApp({
    db: handle.db,
    corsOrigins: [ORIGIN],
    session: { ttlDays: 7, secureCookies: false },
  });

  // Guarda todas as respostas JSON, para o teste que procura hashes em tudo o que saiu.
  const seenBodies: string[] = [];

  async function request<T = Record<string, unknown>>(
    method: string,
    path: string,
    opts: { cookie?: string; body?: unknown; origin?: string } = {},
  ) {
    const headers: Record<string, string> = { origin: opts.origin ?? ORIGIN };
    if (opts.cookie) headers.cookie = opts.cookie;
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    const res = await app.request(path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    seenBodies.push(text);
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, headers: res.headers, json: json as T, text };
  }

  async function login(email: string, portal: "staff" | "student", password = DEMO_PASSWORD) {
    const res = await request("POST", "/api/auth/login", { body: { email, password, portal } });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${res.text}`);
    const setCookie = res.headers.get("set-cookie") ?? "";
    return setCookie.split(";")[0]!;
  }

  async function userId(email: string) {
    const [row] = await handle.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return row!.id;
  }

  return { app, db: handle.db, close: handle.close, request, login, userId, seenBodies };
}

export const STUDENT_A = "student@example.com";
export const STUDENT_B = "andre.pinto@example.com";
export const STAFF = "staff@example.com";
