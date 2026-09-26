import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs. The v1 target is an itch.io zip, which is served from
  // an arbitrary path rather than a domain root, so absolute "/assets/..." URLs
  // would 404 for the region Web Worker and the sql.js wasm — taking the game
  // and every save with them. Relative paths work from any directory.
  // Override with ELDRINTH_BASE for a fixed deployment path.
  base: process.env.ELDRINTH_BASE ?? "./",
  plugins: [react(), tailwindcss()],
  build: {
    // Sprite atlases stay as cacheable files instead of swelling the JS bundle
    // with base64 data URLs. Python remains entirely outside the browser build.
    assetsInlineLimit: 0,
    // Release-only source maps: a player's console stack trace should be
    // mappable to real source without shipping readable source to players.
    sourcemap: process.env.ELDRINTH_SOURCEMAP ? "hidden" : false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
