import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Drop `pixelHashes` from sprite manifests as they are bundled.
 *
 * The renderer globs all 53 manifests eagerly, so a per-pixel hash per frame
 * was inlined into the main chunk — about 28 KB of it, 65% of all manifest
 * weight — and shipped to every player. Nothing at runtime reads the field: the
 * `SpriteManifest` interface has no such member. It exists for the offline
 * generator and for `spriteCatalog.test.ts`, which reads the committed files
 * from disk rather than through the bundler, so both are unaffected.
 */
function stripManifestPixelHashes(): Plugin {
  return {
    name: "eldrinth:strip-manifest-pixel-hashes",
    // Must run before Vite's own JSON handling.
    enforce: "pre",
    transform(code, id) {
      const path = id.split("?")[0];
      if (!path.endsWith(".json") || !path.includes("/assets/sprites/")) return null;
      const manifest = JSON.parse(code) as Record<string, unknown>;
      if (!("pixelHashes" in manifest)) return null;
      delete manifest.pixelHashes;
      // Return plain JSON, not an ES module: Vite's own JSON plugin runs after
      // this one and still has to be able to parse what we hand it.
      return { code: JSON.stringify(manifest), map: null };
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs. The v1 target is an itch.io zip, which is served from
  // an arbitrary path rather than a domain root, so absolute "/assets/..." URLs
  // would 404 for the region Web Worker and the sql.js wasm — taking the game
  // and every save with them. Relative paths work from any directory.
  // Override with ELDRINTH_BASE for a fixed deployment path.
  base: process.env.ELDRINTH_BASE ?? "./",
  plugins: [react(), tailwindcss(), stripManifestPixelHashes()],
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
