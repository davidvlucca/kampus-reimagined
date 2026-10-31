import { startStack } from "../scripts/stack.ts";
import { E2E_CRON_SECRET, E2E_PORTS } from "./env.ts";

export default async function globalSetup() {
  // Liga GET /api/cron/reset-demo nesta cópia: é assim que cada teste repõe a demo.
  process.env.CRON_SECRET = E2E_CRON_SECRET;
  const stack = await startStack("e2e", E2E_PORTS);
  return () => stack.stop();
}
