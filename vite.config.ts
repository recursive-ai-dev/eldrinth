import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    // Sprite sheets are loaded via `new Image(); img.src = url`, so they
    // gain nothing from base64 inlining — inlining just bloats the JS
    // bundle and defeats separate HTTP caching for the generated assets.
    // Force every asset (including small sprite sheets under the default
    // 4kb threshold) to emit as a real hashed file.
    assetsInlineLimit: 0,
  },
});
