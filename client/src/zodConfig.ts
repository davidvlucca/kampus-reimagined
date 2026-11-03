// A CSP da app (scripts/vercel-routes.ts) não tem 'unsafe-eval'. O Zod 4 compila os esquemas
// de objetos com `new Function` e, sem isto, cada página dava uma violação de CSP ao testar
// se o eval é permitido. Tem de correr antes de qualquer esquema ser criado: é o primeiro
// import do main.tsx e fica no chunk do zod (ver client/vite.config.ts).
import { z } from "zod";

z.config({ jitless: true });
