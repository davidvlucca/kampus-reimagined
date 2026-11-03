import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // O zod e o src/zodConfig.ts num chunk só deles: o z.config({ jitless }) corre logo a
        // seguir ao zod e antes dos esquemas do shared. No chunk do main corria depois deles, e
        // cada esquema de objeto já tinha testado o eval (violação de CSP em todas as páginas).
        // O scripts/check-bundle.ts confirma que o config ficou no chunk do zod.
        codeSplitting: { groups: [{ name: "zod", test: /node_modules[\\/]zod[\\/]|[\\/]src[\\/]zodConfig\.ts$/ }] },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Em dev o browser fala só com o Vite; /api segue para a API. Mesma origem, cookies simples.
    proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:3000" } },
  },
  preview: { port: 4173, proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:3000" } } },
});
