// Build para a Vercel no formato Build Output API (.vercel/output):
//   static/            o build do client (Vite)
//   functions/api.func  a API (Hono) num só ficheiro, empacotada com esbuild
//   config.json        rotas (ver scripts/vercel-routes.ts: API, SPA, 404, headers de segurança, cache e noindex) e o cron diário
// A Vercel corre isto como buildCommand (ver vercel.json) e publica o resultado tal como está.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { MISSING_ASSET, NOINDEX, NOINDEX_META, vercelRoutes } from "./vercel-routes.ts";

const OUT = ".vercel/output";
const FUNC = `${OUT}/functions/api.func`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(FUNC, { recursive: true });

// 1. Client
const client = spawnSync("npm", ["run", "build", "-w", "client"], { stdio: "inherit" });
if (client.status !== 0) process.exit(client.status ?? 1);
cpSync("client/dist", `${OUT}/static`, { recursive: true });
writeFileSync(`${OUT}/static${MISSING_ASSET.path}`, MISSING_ASSET.body);
if (NOINDEX) {
  const indexHtml = `${OUT}/static/index.html`;
  writeFileSync(indexHtml, readFileSync(indexHtml, "utf8").replace("<head>", `<head>\n    ${NOINDEX_META}`));
}

// 2. API: um bundle ESM com tudo (Hono, Drizzle, pg, hash-wasm, o shared/).
await build({
  entryPoints: ["server/src/vercel.ts"],
  outfile: `${FUNC}/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // pg tenta carregar o pg-native opcional; não o usamos.
  external: ["pg-native"],
  // Algumas dependências CommonJS usam require(); num bundle ESM é preciso criá-lo.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  legalComments: "none",
  logLevel: "info",
});

writeFileSync(
  `${FUNC}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 30 }, null, 2),
);

// 3. Rotas e cron
writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: vercelRoutes(),
      // Repõe os dados de demonstração todos os dias às 04:00 UTC (ver /api/cron/reset-demo).
      crons: [{ path: "/api/cron/reset-demo", schedule: "0 4 * * *" }],
    },
    null,
    2,
  ),
);

console.log(`\nVercel build ready in ${OUT}`);
