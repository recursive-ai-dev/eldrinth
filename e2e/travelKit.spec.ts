import { test, expect, type Page } from "@playwright/test";

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
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
}

test("atlas supports search, pinning, keyboard isolation and save round trip", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await begin(page);
  await page.keyboard.press("m");
  const atlas = page.getByRole("dialog");
  await expect(atlas.locator(".atlas-heading, #atlas-heading")).toBeVisible();
  await expect(atlas.locator(".atlas-landmark").first()).toBeVisible();
  await atlas.locator(".atlas-landmark").first().click();
  await expect(atlas.getByRole("button", { name: "Clear pin", exact: true })).toBeVisible();
  const search = atlas.getByRole("searchbox", { name: "Search atlas" });
  await search.fill("no such destination");
  await expect(atlas.getByText(/No known places match/)).toBeVisible();
  await search.pressSequentially("mlr");
  await expect(search).toHaveValue("no such destinationmlr");
  await search.press("Escape");
  await expect(atlas).toBeHidden();
  await page.keyboard.press("Escape");
  const pause = page.getByRole("dialog", { name: "PAUSED", exact: true });
  await pause.getByRole("button", { name: "SAVE CHECKPOINT", exact: true }).click();
  await expect(pause.getByText("Your pilgrimage is saved.")).toBeVisible();
  await pause.getByRole("button", { name: "Journey", exact: true }).click();
  await expect(pause.getByRole("heading", { name: "Your pilgrimage" })).toBeVisible();
  await expect(pause).toContainText("Taking vessel 1 costs 0 permanent maximum health");
  await page.screenshot({ path: test.info().outputPath("journey.png") });
  await pause.getByRole("button", { name: "SAVE & RETURN TO TITLE", exact: true }).click();
  await expect(page.getByRole("button", { name: /SLOT 1/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("m");
  await expect(page.locator(".atlas-landmark").first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("atlas.png") });
  expect(errors).toEqual([]);
});

test("comfort settings persist and focus loss pauses active play", async ({ page }) => {
  await begin(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const pause = page.getByRole("dialog", { name: "PAUSED", exact: true });
  await expect(pause).toBeVisible();
  await pause.getByRole("button", { name: "Display", exact: true }).click();
  await pause.getByRole("checkbox", { name: /High contrast interface/ }).check();
  await pause.getByRole("checkbox", { name: /Ambient weather overlay/ }).uncheck();
  await pause.getByRole("checkbox", { name: /Camera shake/ }).uncheck();
  await expect(page.locator(".app-root")).toHaveClass(/high-contrast/);
  await expect(page.locator(".world-atmosphere")).toHaveCount(0);
  await pause.getByRole("button", { name: "SAVE & RETURN TO TITLE", exact: true }).click();
  await expect(page.getByRole("button", { name: /SLOT 1/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await expect(page.locator(".app-root")).toHaveClass(/high-contrast/);
  await page.keyboard.press("Escape");
  await pause.getByRole("button", { name: "Display", exact: true }).click();
  await expect(pause.getByRole("checkbox", { name: /Camera shake/ })).not.toBeChecked();
  await pause.getByRole("checkbox", { name: /Pause when focus leaves/ }).uncheck();
  await pause.getByRole("button", { name: "RESUME", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(pause).toBeHidden();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`atlas works by touch at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, baseURL: "http://127.0.0.1:4173/eldrinth/" });
    try {
      await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
      const page = await context.newPage();
      await begin(page);
      const atlasButton = page.getByRole("button", { name: "Atlas", exact: true });
      await expect(atlasButton).toBeInViewport({ ratio: 1 });
      const boxes = await Promise.all([
        atlasButton.boundingBox(),
        page.getByRole("button", { name: "Lantern", exact: true }).boundingBox(),
        page.getByTestId("hud-wayfinder").boundingBox(),
        page.getByRole("button", { name: "Parry", exact: true }).boundingBox(),
      ]);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        expect(a).not.toBeNull(); expect(b).not.toBeNull();
        expect(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y).toBe(false);
      }
      await atlasButton.tap();
      const atlas = page.getByRole("dialog");
      await expect(atlas.locator("#atlas-heading")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`atlas-${viewport.width}.png`) });
      await atlas.getByRole("button", { name: "ESC / M / CLOSE", exact: true }).tap();
      await expect(atlas).toBeHidden();
    } finally { await context.close(); }
  });
}
