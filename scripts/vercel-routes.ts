// Rotas da Vercel (Build Output API) e indexação. Usado por scripts/build-vercel.ts.

/**
 * Esconde o site dos motores de busca: header `X-Robots-Tag: noindex` em todas as
 * respostas (páginas, ficheiros e API) e `<meta name="robots" content="noindex">` no HTML.
 * Para deixar indexar, muda para `false` e volta a publicar. É o único sítio onde isto vive.
 */
export const NOINDEX = true;

export const NOINDEX_META = '<meta name="robots" content="noindex" />';

/**
 * As rotas que a app conhece (têm de bater com client/src/router.tsx). Estas recebem o
 * index.html com 200; qualquer outro caminho recebe o mesmo index.html mas com 404, e o
 * React Router mostra a página "This page took a wrong turn".
 */
export const SPA_ROUTES = [
  "^/$",
  "^/login/(student|staff)/?$",
  "^/app(/(tasks|notes|tour|contacts|profile))?/?$",
  "^/app/notes/[^/]+/?$",
  "^/staff(/(students|assignments|profile))?/?$",
];

/**
 * Um ficheiro de /assets/ que não existe (ex.: um chunk de um deploy anterior, pedido por um
 * separador que ficou aberto) recebe este texto com 404, nunca o index.html: um import()
 * que recebesse HTML falhava com um erro confuso. O build escreve-o no output estático.
 */
export const MISSING_ASSET = { path: "/asset-not-found.txt", body: "Not found.\n" } as const;

/**
 * Headers de segurança das páginas e dos ficheiros estáticos (a API tem os seus, ver
 * server/src/app.ts). O `vite preview` aplica os mesmos (client/vite.config.ts), por isso os
 * testes E2E correm já com esta CSP. O build não gera scripts inline: `script-src 'self'`
 * chega. Os estilos inline são os `style={...}` do React (e os do three.js na visita).
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
} as const;

/** Tudo menos /api e /api/... (a API responde com os headers dela). */
export const NON_API_PATHS = "^/(?!api(?:/|$)).*$";

/**
 * As ilustrações da visita e o favicon (client/public) não têm hash no nome: um dia de cache,
 * e mais uma semana a servir a cópia antiga enquanto revalida. Uma ilustração nova aparece no
 * máximo no dia seguinte, sem pedir de novo cada SVG em cada paragem.
 */
export const PUBLIC_SVG = "^/(favicon\\.svg|tour/[^/]+\\.svg)$";
export const PUBLIC_SVG_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

export const LOGIN_REDIRECT = { src: "^/login/?$", status: 308, headers: { Location: "/login/student" } } as const;

export function isKnownSpaPath(path: string): boolean {
  return SPA_ROUTES.some((pattern) => new RegExp(pattern).test(path));
}

export function vercelRoutes() {
  return [
    ...(NOINDEX ? [{ src: "^/(.*)$", headers: { "X-Robots-Tag": "noindex" }, continue: true }] : []),
    { src: NON_API_PATHS, headers: SECURITY_HEADERS, continue: true },
    // Ficheiros com hash no nome: cache longa.
    { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
    { src: PUBLIC_SVG, headers: { "cache-control": PUBLIC_SVG_CACHE }, continue: true },
    { src: "^/api(/.*)?$", dest: "/api" },
    // Um /login sem perfil vai para o de aluno (o React Router faz o mesmo no client).
    LOGIN_REDIRECT,
    { handle: "filesystem" },
    // Já passou pelo filesystem: um /assets/* que chega aqui não existe. Sem a cache longa de cima.
    { src: "^/assets/(.*)$", dest: MISSING_ASSET.path, status: 404, headers: { "cache-control": "no-store" } },
    { src: PUBLIC_SVG, dest: MISSING_ASSET.path, status: 404, headers: { "cache-control": "no-store" } },
    ...SPA_ROUTES.map((src) => ({ src, dest: "/index.html" })),
    { src: "^/(.*)$", dest: "/index.html", status: 404 },
  ];
}
