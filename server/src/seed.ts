// Uso: npm run db:seed (acrescenta numa base vazia) · npm run db:reset (apaga e repõe).
// SEED_DATE=YYYY-MM-DD fixa o "hoje" do seed, para os prints serem reprodutíveis.
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { dbFromEnv } from "./db/client.ts";
import { users } from "./db/schema.ts";
import { DEMO_PASSWORD, resetDatabase, seedDatabase } from "./demo-data.ts";


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");

  // Barreira: com DATABASE_URL (ex.: Neon) o seed recusa, a não ser que o peçam explicitamente.
  if (process.env.DATABASE_URL && !args.includes("--allow-remote")) {
    console.error("Seed refused: DATABASE_URL is set. Run with --allow-remote if this is really a demo database. Nothing was changed.");
    process.exit(1);
  }

  const today = process.env.SEED_DATE;
  if (today && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    console.error("SEED_DATE must be YYYY-MM-DD");
    process.exit(1);
  }

  const handle = dbFromEnv();
  await handle.migrate();
  if (reset) {
    await resetDatabase(handle.db);
  } else {
    const [row] = await handle.db.select({ n: sql<number>`count(*)::int` }).from(users);
    if ((row?.n ?? 0) > 0) {
      console.log("The database already has data. Use `npm run db:reset` to start over.");
      await handle.close();
      process.exit(0);
    }
  }
  const result = await seedDatabase(handle.db, today ? { today } : {});
  await handle.close();
  console.log(
    `Seed done: ${result.cohorts} cohorts, ${result.staff} staff, ${result.students} students. Password for every account: ${DEMO_PASSWORD}`,
  );
}
