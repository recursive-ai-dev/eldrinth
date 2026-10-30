import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// The suite is scoped to `src` deliberately. `bench/` holds measurement
// harnesses that are slow, print instead of assert, and monkey-patch globals;
// letting vitest's default `**/*.test.ts` glob reach them would let a
// diagnostic tool break or slow the release gate. Run those with `npm run bench`.
//
// Merging from vite.config.ts (rather than restating the alias) keeps the `@/`
// mapping in one place. This file takes precedence over vite.config.ts when
// vitest resolves its config, so anything not restated here must be merged in.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      environment: "node",
      // Map/snapshot suites allocate whole worlds. Bound concurrency on desktop
      // workstations and CI rather than scaling memory with logical CPU count.
      maxWorkers: 2,
    },
  }),
);
