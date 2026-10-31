// Arranca uma cópia isolada da app para os prints e o vídeo: base PGlite própria
// (server/.data/<nome>) com o seed numa data fixa, a API numa porta e o build do
// client servido pelo `vite preview` noutra. Não toca na base da demo.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

export const SEED_DATE = "2026-11-02";
/** O "agora" do browser nos prints: segunda-feira de manhã, no dia do seed. */
export const BROWSER_NOW = new Date(`${SEED_DATE}T09:40:00`);

interface Stack {
  baseUrl: string;
  stop: () => void;
}

async function waitFor(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ainda a arrancar
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export async function startStack(name: string, ports = { api: 3101, web: 4174 }): Promise<Stack> {
  const dataDir = `.data/${name}`;
  rmSync(`server/${dataDir}`, { recursive: true, force: true });
  const env = {
    ...process.env,
    DATABASE_URL: "",
    PGLITE_DIR: dataDir,
    SEED_DATE,
    API_PORT: String(ports.api),
    CORS_ORIGIN: `http://localhost:${ports.web}`,
    API_URL: `http://localhost:${ports.api}`,
  };

  const seed = spawnSync("node", ["src/seed.ts", "--reset"], { cwd: "server", env, stdio: "inherit" });
  if (seed.status !== 0) throw new Error("Seed failed");

  const build = spawnSync("npm", ["run", "build", "-w", "client"], { env, stdio: "inherit" });
  if (build.status !== 0) throw new Error("Client build failed");

  const children: ChildProcess[] = [
    spawn("node", ["src/index.ts"], { cwd: "server", env, stdio: "inherit" }),
    spawn("npx", ["vite", "preview", "--port", String(ports.web), "--strictPort"], { cwd: "client", env, stdio: "inherit" }),
  ];
  const stop = () => children.forEach((c) => c.kill("SIGTERM"));
  process.on("exit", stop);

  const baseUrl = `http://localhost:${ports.web}`;
  await waitFor(`http://localhost:${ports.api}/api/health`);
  await waitFor(baseUrl);
  return { baseUrl, stop };
}
