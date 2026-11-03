// Orçamento do bundle do client, depois do build (corre no CI): o JS que o index.html carrega
// logo no arranque e o chunk da visita 3D (CampusMap-*). Tamanhos em gzip com as opções por
// omissão do zlib, em KB de 1000 bytes (como o Vite mostra). Uso: node scripts/check-bundle.ts [dist]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = { initial: 200, campusMap: 255 };

const dist = process.argv[2] ?? "client/dist";
const assets = join(dist, "assets");
const html = readFileSync(join(dist, "index.html"), "utf8");

const kb = (bytes: number) => bytes / 1000;
const gz = (file: string) => gzipSync(readFileSync(join(assets, file))).length;

// O <script> do main e os <link rel="modulepreload">: tudo o que se descarrega antes do primeiro render.
const initial = new Set([...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]!));
const files = readdirSync(assets).filter((f) => f.endsWith(".js"));
const rows = files.map((file) => ({ file, gzip: gz(file), initial: initial.has(file) })).sort((a, b) => b.gzip - a.gzip);

console.log("chunk".padEnd(44), "gzip KB".padStart(9), " initial");
for (const r of rows) console.log(r.file.padEnd(44), kb(r.gzip).toFixed(2).padStart(9), r.initial ? " yes" : "");

const problems: string[] = [];
const initialTotal = rows.filter((r) => r.initial).reduce((sum, r) => sum + r.gzip, 0);
console.log(`\ninitial JS: ${kb(initialTotal).toFixed(2)} KB gz (budget ${BUDGET_KB.initial} KB)`);
if (initial.size === 0) problems.push("index.html doesn't reference any JS in /assets");
if (kb(initialTotal) > BUDGET_KB.initial) problems.push(`initial JS is ${kb(initialTotal).toFixed(2)} KB gz, over ${BUDGET_KB.initial} KB`);

const campusMap = rows.find((r) => r.file.startsWith("CampusMap-"));
if (!campusMap) problems.push("no CampusMap-*.js chunk (the 3D tour should be its own lazy chunk)");
else {
  console.log(`CampusMap chunk: ${kb(campusMap.gzip).toFixed(2)} KB gz (budget ${BUDGET_KB.campusMap} KB)`);
  if (campusMap.initial) problems.push("the CampusMap chunk is loaded at startup");
  if (kb(campusMap.gzip) > BUDGET_KB.campusMap) problems.push(`CampusMap is ${kb(campusMap.gzip).toFixed(2)} KB gz, over ${BUDGET_KB.campusMap} KB`);
}

// A CSP não deixa usar eval: o z.config({ jitless }) tem de ficar no chunk do zod, para correr
// antes dos esquemas do shared (ver client/vite.config.ts e client/src/zodConfig.ts).
const zodChunk = files.find((f) => readFileSync(join(assets, f), "utf8").includes("__zod_globalConfig"));
if (!zodChunk) problems.push("couldn't find the chunk with zod");
else if (!/jitless:\s*(?:!0|true)/.test(readFileSync(join(assets, zodChunk), "utf8"))) {
  problems.push(`z.config({ jitless: true }) isn't in the zod chunk (${zodChunk}): the CSP would block zod's eval check`);
}

if (problems.length) {
  console.error(`\nBundle check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("\nBundle check passed.");
