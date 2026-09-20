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
  server: {
    host: "0.0.0.0",
    // Vite rejects unknown Host headers by default, which breaks hosted
    // previews. Allow the preview domain's subdomains rather than disabling the
    // check outright.
    allowedHosts: [".e2b.app"],
  },
  build: {
    // Sprite atlases stay as cacheable files instead of swelling the JS bundle
    // with base64 data URLs. Python remains entirely outside the browser build.
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
