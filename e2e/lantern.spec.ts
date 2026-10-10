import { test, expect, type Page } from "@playwright/test";
import initSqlJs from "sql.js";
import { resolve } from "node:path";
import { TILE } from "../src/game/constants";
import { LANTERN_RECORDS } from "../src/game/lantern";
import type { WorldSnapshot } from "../src/game/core/WorldState";

const STORAGE_KEY = "eldrinth.sqlite.v1";
const record = LANTERN_RECORDS[0];
const journalId = `lamplight:${record.id}`;
const prompt = "Press E to read lamplight writing";

test.beforeEach(async ({ context }) => {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

async function begin(page: Page) {
  await page.goto("/eldrinth/");
  const warning = page.getByRole("button", { name: "I UNDERSTAND" });
  if (await warning.isVisible()) await warning.click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await ready(page);
}

async function ready(page: Page) {
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
}

async function saveAndReturn(page: Page) {
  await page.keyboard.press("i");
  await page.getByRole("button", { name: "SAVE & RETURN TO TITLE", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ELDRINTH", exact: true })).toBeVisible();
}

async function continueSlot(page: Page) {
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await ready(page);
}

async function readSavedWorld(page: Page): Promise<WorldSnapshot> {
  const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  expect(saved).not.toBeNull();
  const SQL = await initSqlJs({ locateFile: file => resolve("node_modules/sql.js/dist", file) });
  const database = new SQL.Database(Buffer.from(saved!, "base64"));
  try {
    const json = database.exec("SELECT world_json FROM save_slots WHERE id = 1")[0].values[0][0];
    return JSON.parse(String(json)) as WorldSnapshot;
  } finally {
    database.close();
  }
}

async function seedBesideWriting(page: Page) {
  // Use the game's save UI before editing this test's isolated browser record.
  // No live engine state or additional production debug interface is needed.
  await begin(page);
  await saveAndReturn(page);
  const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  expect(saved).not.toBeNull();
  const SQL = await initSqlJs({ locateFile: file => resolve("node_modules/sql.js/dist", file) });
  const database = new SQL.Database(Buffer.from(saved!, "base64"));
  let seeded: string;
  try {
    const json = database.exec("SELECT world_json FROM save_slots WHERE id = 1")[0].values[0][0];
    const world = JSON.parse(String(json)) as WorldSnapshot;
    world.regionId = record.regionId;
    world.player.x = (record.x + 0.5) * TILE;
    world.player.y = (record.y + 0.5) * TILE;
    world.enemies = [];
    world.projectiles = [];
    world.items = [];
    world.regions = {};
    world.bossId = null;
    world.journal = (world.journal ?? []).filter(entry => !entry.id.startsWith("lamplight:"));
    database.run("UPDATE save_slots SET world_json = ? WHERE id = 1", [JSON.stringify(world)]);
    seeded = Buffer.from(database.export()).toString("base64");
  } finally {
    database.close();
  }
  // The game has already unmounted; reload the title database after replacement.
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: seeded });
  await page.reload();
  await continueSlot(page);
}

async function readWriting(page: Page) {
  await page.keyboard.press("e");
  const dialogue = page.getByRole("dialog", { name: `${record.title} speaks`, exact: true });
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText(record.text);
  // Dialogue has a short input guard against the same press opening and
  // closing it. Retry real clicks after that guard instead of fixed sleeps.
  await expect.poll(async () => {
    if (await dialogue.isVisible()) await dialogue.click();
    return dialogue.isVisible();
  }, { intervals: [200] }).toBe(false);
}

async function expectOneJournalRecord(page: Page) {
  await page.keyboard.press("l");
  const journal = page.getByRole("dialog", { name: /Notes, Cores/ });
  const category = journal.getByRole("button", { name: /^Lamplight \(1\)$/ });
  await expect(category).toBeVisible();
  await category.click();
  await expect(category).toHaveAttribute("aria-pressed", "true");
  await expect(journal.getByRole("article")).toHaveCount(1);
  await expect(journal.getByRole("heading", { name: record.title, exact: true })).toBeVisible();
  await expect(journal).toContainText(record.text);
  return journal;
}

test("lamplight reveals hidden writing and preserves one journal record across a cold load", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await seedBesideWriting(page);
  const lantern = page.getByRole("button", { name: "Lantern", exact: true });
  const writing = page.getByText(prompt, { exact: true });
  await expect(lantern).toHaveAttribute("aria-pressed", "false");
  await expect(writing).toBeHidden();
  await page.keyboard.press("l");
  await expect(page.getByRole("button", { name: /^Lamplight \(/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.keyboard.press("r");
  await expect(lantern).toHaveAttribute("aria-pressed", "true");
  await expect(writing).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("lamplight-writing-revealed.png") });
  await readWriting(page);
  const journal = await expectOneJournalRecord(page);
  // The toggle shortcut must not consume characters entered in the journal.
  const note = journal.locator("#journal-note");
  await note.pressSequentially("rare marks remain");
  await expect(note).toHaveValue("rare marks remain");
  await expect(journal.getByRole("button", { name: /^Lamplight \(1\)$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(lantern).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: test.info().outputPath("lamplight-journal.png") });
  await note.press("Escape");
  await saveAndReturn(page);
  expect((await readSavedWorld(page)).journal?.filter(entry => entry.id === journalId)).toHaveLength(1);

  await page.reload();
  await continueSlot(page);
  await expect(lantern).toHaveAttribute("aria-pressed", "false");
  await expect(writing).toBeHidden();
  await expectOneJournalRecord(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("r");
  await expect(lantern).toHaveAttribute("aria-pressed", "true");
  await readWriting(page);
  await expectOneJournalRecord(page);
  await page.keyboard.press("Escape");
  await saveAndReturn(page);
  expect((await readSavedWorld(page)).journal?.filter(entry => entry.id === journalId)).toHaveLength(1);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`touch lantern is reachable and toggles at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, baseURL: "http://127.0.0.1:4173/eldrinth/" });
    try {
      await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
      const page = await context.newPage();
      await begin(page);
      const lantern = page.getByRole("button", { name: "Lantern", exact: true });
      await expect(lantern).toHaveCount(1);
      await expect(lantern).toBeInViewport({ ratio: 1 });
      await expect(lantern).toHaveAttribute("aria-pressed", "false");
      await lantern.tap();
      await expect(lantern).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({ path: test.info().outputPath(`touch-lantern-${viewport.width}.png`) });
      await lantern.tap();
      await expect(lantern).toHaveAttribute("aria-pressed", "false");
    } finally {
      await context.close();
    }
  });
}
