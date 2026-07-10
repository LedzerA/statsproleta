import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" para funcionar em qualquer caminho do GitHub Pages
// (usuario.github.io/repo/ ou domínio próprio).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
