import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    // Optional installed-browser channel for local runs; CI uses bundled Chromium.
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: "http://127.0.0.1:4173/eldrinth/",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base=/eldrinth/",
    url: "http://127.0.0.1:4173/eldrinth/",
    reuseExistingServer: false,
  },
});
