import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../src/db/client.ts";
import { migrationsPending } from "../src/db/migrations.ts";
import { createTestDb } from "./helpers.ts";

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
  await handle.migrate();
});
afterAll(() => handle.close());

// Em npm run test:pg corre por node-postgres, onde o bigint `created_at` chega como texto.
describe("migrationsPending", () => {
  it("numa base migrada não falta nada; sem a migração mais recente, falta", async () => {
    expect(await migrationsPending(handle.db)).toBe(false);
    await handle.db.execute(
      sql`delete from drizzle.__drizzle_migrations where created_at = (select max(created_at) from drizzle.__drizzle_migrations)`,
    );
    expect(await migrationsPending(handle.db)).toBe(true);
  });
});
