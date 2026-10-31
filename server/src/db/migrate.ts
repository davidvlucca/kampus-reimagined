import { dbFromEnv } from "./client.ts";

const handle = dbFromEnv();
await handle.migrate();
await handle.close();
console.log(`Migrations applied (${handle.kind}).`);
