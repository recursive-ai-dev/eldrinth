import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import viteConfig from "../vite.config";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Benchmarks are measurement harnesses, not assertions: they print numbers and
// only fail on a thrown error. They are kept out of `npm test` and run on demand
// via `npm run bench`.
//
// `root` is pinned to the repo root because this config file lives in bench/ and
// Vite would otherwise treat bench/ as the project root, which breaks both the
// `@/` alias and the `src/assets` import.meta.glob in spriteAtlas.ts.
export default defineConfig({
  root,
  resolve: viteConfig.resolve,
  test: {
    include: ["bench/**/*.bench.test.ts"],
    environment: "node",
    testTimeout: 300000,
    hookTimeout: 300000,
  },
});
