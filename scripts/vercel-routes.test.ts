import { describe, expect, it } from "vitest";
import { isKnownSpaPath, NOINDEX, vercelRoutes } from "./vercel-routes.ts";

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
  "/staff/profile",
];

const UNKNOWN = ["/nope", "/app/nope", "/login", "/login/admin", "/staff/students/123", "/app/notes/1/extra", "/wp-admin"];

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

  it("com NOINDEX ligado, a primeira rota põe X-Robots-Tag em tudo", () => {
    if (!NOINDEX) return;
    expect(vercelRoutes()[0]).toEqual({ src: "^/(.*)$", headers: { "X-Robots-Tag": "noindex" }, continue: true });
  });
});
