import { test, expect } from "@playwright/test";
import initSqlJs from "sql.js";
import { resolve } from "node:path";
import type { WorldSnapshot } from "../src/game/core/WorldState";

test("fortress lantern light reveals the player and floor without erasing the canvas", async ({ page, context }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto("/eldrinth/");
  const warning = page.getByRole("button", { name: "I UNDERSTAND" });
  if (await warning.isVisible()) await warning.click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.evaluate(() => (window as typeof window & { eldrinthCheckpoint?: () => Promise<void> }).eldrinthCheckpoint?.());
  const saved = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  expect(saved).not.toBeNull();

  // Seed this isolated browser profile through the actual SQLite save format.
  // A cleared fortress removes combat timing from the rendering regression.
  const SQL = await initSqlJs({ locateFile: file => resolve("node_modules/sql.js/dist", file) });
  const database = new SQL.Database(Buffer.from(saved!, "base64"));
  let seeded: string;
  try {
    const record = database.exec("SELECT world_json FROM save_slots WHERE id = 1")[0].values[0][0];
    const world = JSON.parse(String(record)) as WorldSnapshot;
    world.regionId = "fortress.old-lands-archive";
    world.player.x = 368;
    world.player.y = 464;
    world.enemies = [];
    world.projectiles = [];
    world.regions = {};
    world.items = [{ type: "shard", x: 368, y: 464, t: 0, taken: false }];
    database.run("UPDATE save_slots SET world_json = ? WHERE id = 1", [JSON.stringify(world)]);
    seeded = Buffer.from(database.export()).toString("base64");
  } finally {
    database.close();
  }
  // Leave the running engine before replacing its record, then reload the
  // title's database connection so it reads the seeded record from storage.
  await page.goto("about:blank");
  await page.goto("/eldrinth/");
  await page.evaluate(value => localStorage.setItem("eldrinth.sqlite.v1", value), seeded);
  await page.reload();
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await expect(page.getByText("Press E to hear the person inside", { exact: true })).toBeVisible();

  const canvas = page.locator("canvas");
  const pixels = await canvas.evaluate(async element => {
    // Wait for a complete rendered frame after initialization. The camera
    // centers the stationary player; sample the actual backing-store pixels.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const context = element.getContext("2d")!;
    const x = Math.floor(element.width / 2);
    const y = Math.floor(element.height / 2);
    const center = [...context.getImageData(x, y, 1, 1).data];
    const nearby = context.getImageData(x - 8, y - 8, 17, 17).data;
    let brightest = 0;
    for (let i = 0; i < nearby.length; i += 4) {
      brightest = Math.max(brightest, (nearby[i] + nearby[i + 1] + nearby[i + 2]) / 3);
    }
    return { center, brightest };
  });
  await page.screenshot({ path: test.info().outputPath("fortress-lantern-light.png") });
  expect(pixels.center[3], "Lantern light must preserve the rendered scene's alpha").toBe(255);
  expect(pixels.brightest, "The illuminated player and nearby ground must remain visible").toBeGreaterThan(20);
});
