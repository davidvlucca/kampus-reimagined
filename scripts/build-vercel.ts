// Build para a Vercel no formato Build Output API (.vercel/output):
//   static/            o build do client (Vite)
//   functions/api.func  a API (Hono) num só ficheiro, empacotada com esbuild
//   config.json        rotas (/api/* → função, resto → SPA) e o cron diário
// A Vercel corre isto como buildCommand (ver vercel.json) e publica o resultado tal como está.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const OUT = ".vercel/output";
const FUNC = `${OUT}/functions/api.func`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(FUNC, { recursive: true });

// 1. Client
const client = spawnSync("npm", ["run", "build", "-w", "client"], { stdio: "inherit" });
if (client.status !== 0) process.exit(client.status ?? 1);
cpSync("client/dist", `${OUT}/static`, { recursive: true });

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
      routes: [
        // Ficheiros com hash no nome: cache longa.
        { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { src: "^/api(/.*)?$", dest: "/api" },
        { handle: "filesystem" },
        // React Router trata das restantes (incluindo a página 404).
        { src: "^/(.*)$", dest: "/index.html" },
      ],
      // Repõe os dados de demonstração todos os dias às 04:00 UTC (ver /api/cron/reset-demo).
      crons: [{ path: "/api/cron/reset-demo", schedule: "0 4 * * *" }],
    },
    null,
    2,
  ),
);

console.log(`\nVercel build ready in ${OUT}`);
