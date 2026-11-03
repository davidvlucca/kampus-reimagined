import { describe, expect, it } from "vitest";
import { isKnownSpaPath, MISSING_ASSET, NOINDEX, NON_API_PATHS, SECURITY_HEADERS, vercelRoutes } from "./vercel-routes.ts";

// Um caminho de exemplo por cada rota de client/src/router.tsx.
const KNOWN = [
  "/",
  "/login/student",
  "/login/staff",
  "/app",
  "/app/",
  "/app/tasks",
  "/app/notes",
  "/app/notes/7986c509-4171-4a90-bd63-5d6bad8059e5",
  "/app/tour",
  "/app/contacts",
  "/app/profile",
  "/staff",
  "/staff/students",
  "/staff/assignments",
  "/staff/profile",
];

const UNKNOWN = ["/nope", "/app/nope", "/login", "/login/admin", "/staff/students/123", "/staff/assignments/123", "/app/notes/1/extra", "/wp-admin"];

describe("rotas da Vercel", () => {
  it.each(KNOWN)("%s é uma rota da app (200)", (path) => expect(isKnownSpaPath(path)).toBe(true));
  it.each(UNKNOWN)("%s não existe (404)", (path) => expect(isKnownSpaPath(path)).toBe(false));

  it("o último recurso devolve o index.html com 404 e a API vem antes do SPA", () => {
    const routes = vercelRoutes();
    expect(routes.at(-1)).toEqual({ src: "^/(.*)$", dest: "/index.html", status: 404 });
    const api = routes.findIndex((r) => "dest" in r && r.dest === "/api");
    const filesystem = routes.findIndex((r) => "handle" in r);
    expect(api).toBeLessThan(filesystem);
  });

  it("um /assets/* que não existe dá 404 em texto, não o index.html (e vem depois do filesystem)", () => {
    const routes = vercelRoutes();
    const filesystem = routes.findIndex((r) => "handle" in r);
    const missing = routes.findIndex((r) => "dest" in r && r.dest === MISSING_ASSET.path);
    expect(missing).toBeGreaterThan(filesystem);
    expect(routes[missing]).toMatchObject({ src: "^/assets/(.*)$", status: 404 });
    expect(new RegExp(routes[missing]!.src!).test("/assets/TourPage-abc123.js")).toBe(true);
    // Nenhuma rota anterior manda um /assets/* para o index.html.
    const spaBefore = routes.slice(filesystem, missing).some((r) => "dest" in r && r.dest === "/index.html");
    expect(spaBefore).toBe(false);
    expect(MISSING_ASSET.path.startsWith("/assets/")).toBe(false);
  });

  it("com NOINDEX ligado, a primeira rota põe X-Robots-Tag em tudo", () => {
    if (!NOINDEX) return;
    expect(vercelRoutes()[0]).toEqual({ src: "^/(.*)$", headers: { "X-Robots-Tag": "noindex" }, continue: true });
  });

  it("as páginas e os ficheiros levam os headers de segurança; a API não (tem os seus)", () => {
    const routes = vercelRoutes();
    const security = routes.findIndex((r) => "headers" in r && r.headers === SECURITY_HEADERS);
    expect(routes[security]).toEqual({ src: NON_API_PATHS, headers: SECURITY_HEADERS, continue: true });
    // Antes da API e do filesystem, para valer em tudo o que não é /api.
    expect(security).toBeLessThan(routes.findIndex((r) => "dest" in r && r.dest === "/api"));
    const matches = (path: string) => new RegExp(NON_API_PATHS).test(path);
    for (const path of ["/", "/login/student", "/app/tour", "/assets/index-abc.js", "/favicon.svg", "/apiary", "/nope"]) {
      expect(matches(path), path).toBe(true);
    }
    for (const path of ["/api", "/api/", "/api/auth/me", "/api/health"]) expect(matches(path), path).toBe(false);
  });

  it("a CSP não deixa correr scripts de fora nem eval, e a página não pode ir para um iframe", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    const directives = Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1).join(" ")]));
    expect(directives["script-src"]).toBe("'self'");
    expect(csp).not.toMatch(/unsafe-eval|wasm-unsafe-eval|\*/);
    expect(directives["frame-ancestors"]).toBe("'none'");
    expect(directives["object-src"]).toBe("'none'");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });
});
