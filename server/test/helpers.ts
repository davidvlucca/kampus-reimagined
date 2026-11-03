import { DEMO_PASSWORD } from "@kampus/shared";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.ts";
import { createDb } from "../src/db/client.ts";
import { users } from "../src/db/schema.ts";
import { seedDatabase } from "../src/demo-data.ts";

export const ORIGIN = "http://localhost:5173";

/** Uma app com base PGlite só em memória, migrada e com o seed de demo. */
export async function setup() {
  const handle = createDb({ pgliteDir: "memory" });
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
