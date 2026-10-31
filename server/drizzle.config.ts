import { defineConfig } from "drizzle-kit";

// Só gera SQL a partir do esquema; não liga a nenhuma base. As mesmas migrações
// servem para o PGlite (demo e testes) e para o Neon (produção).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
