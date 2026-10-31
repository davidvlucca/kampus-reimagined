import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Em dev o browser fala só com o Vite; /api segue para a API. Mesma origem, cookies simples.
    proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:3000" } },
  },
  preview: { port: 4173, proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:3000" } } },
});
