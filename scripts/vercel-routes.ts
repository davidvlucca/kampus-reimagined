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

export function isKnownSpaPath(path: string): boolean {
  return SPA_ROUTES.some((pattern) => new RegExp(pattern).test(path));
}

export function vercelRoutes() {
  return [
    ...(NOINDEX ? [{ src: "^/(.*)$", headers: { "X-Robots-Tag": "noindex" }, continue: true }] : []),
    // Ficheiros com hash no nome: cache longa.
    { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
    { src: "^/api(/.*)?$", dest: "/api" },
    { handle: "filesystem" },
    // Já passou pelo filesystem: um /assets/* que chega aqui não existe. Sem a cache longa de cima.
    { src: "^/assets/(.*)$", dest: MISSING_ASSET.path, status: 404, headers: { "cache-control": "no-store" } },
    ...SPA_ROUTES.map((src) => ({ src, dest: "/index.html" })),
    { src: "^/(.*)$", dest: "/index.html", status: 404 },
  ];
}
