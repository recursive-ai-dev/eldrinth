import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

async function begin(page: Page) {
  await page.goto("/eldrinth/");
  await page.getByRole("button", { name: "I UNDERSTAND" }).click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("loading-screen")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
}

test("controls rebind without opening the atlas during capture and persist after reload", async ({ page }) => {
  await begin(page);
  await page.keyboard.press("Escape");
  const pause = page.getByRole("dialog", { name: "PAUSED", exact: true });
  await pause.getByRole("button", { name: "Controls", exact: true }).click();
  await pause.getByRole("button", { name: "Rebind Field journal, currently L", exact: true }).click();
  await page.keyboard.press("m");
  await expect(pause.getByRole("button", { name: "Rebind Field journal, currently M", exact: true })).toBeVisible();
  await expect(pause.getByRole("button", { name: "Rebind Local atlas, currently L", exact: true })).toBeVisible();
  await expect(page.locator("#atlas-heading")).toBeHidden();
  await pause.getByRole("button", { name: "Rebind Raise / shutter lantern, currently R", exact: true }).click();
  await page.keyboard.press("k");
  await pause.getByRole("button", { name: "RESUME", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lantern", exact: true })).toContainText("K · LANTERN");
  await page.keyboard.press("k");
  await expect(page.getByRole("button", { name: "Lantern", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: "Lantern", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("m");
  await expect(page.locator("#journal-heading")).toBeVisible();
  await expect(page.getByRole("button", { name: "ESC / M / CLOSE", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("l");
  await expect(page.locator("#atlas-heading")).toBeVisible();
  await expect(page.getByRole("button", { name: "ESC / L / CLOSE", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await pause.getByRole("button", { name: "SAVE & RETURN TO TITLE", exact: true }).click();
  await expect(page.getByRole("button", { name: /SLOT 1/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("loading-screen")).toBeHidden({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await pause.getByRole("button", { name: "Controls", exact: true }).click();
  await expect(pause.getByRole("button", { name: "Rebind Raise / shutter lantern, currently K", exact: true })).toBeVisible();
  await pause.getByRole("button", { name: "Restore default controls", exact: true }).click();
  await expect(pause.getByRole("button", { name: "Rebind Field journal, currently L", exact: true })).toBeVisible();
  await expect(pause.getByRole("button", { name: "Rebind Raise / shutter lantern, currently R", exact: true })).toBeVisible();
});

test("standard controller buttons toggle the lantern and Start waits for release before resuming", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { pressed: [] as number[] };
    (window as typeof window & { controllerTest: typeof state }).controllerTest = state;
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [{ connected: true, mapping: "standard", axes: [0, 0], buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: state.pressed.includes(index), value: state.pressed.includes(index) ? 1 : 0 })) }] });
  });
  const press = (buttons: number[]) => page.evaluate(buttons => { (window as typeof window & { controllerTest: { pressed: number[] } }).controllerTest.pressed = buttons; }, buttons);
  await begin(page);
  await press([3]);
  await expect(page.getByRole("button", { name: "Lantern", exact: true })).toHaveAttribute("aria-pressed", "true");
  await press([]);
  // A short wait gives the fixed-step engine one tick to observe the release.
  await page.waitForTimeout(60);
  await press([9]);
  const pause = page.getByRole("dialog", { name: "PAUSED", exact: true });
  await expect(pause).toBeVisible();
  await page.waitForTimeout(150);
  await expect(pause).toBeVisible();
  await press([]);
  await page.waitForTimeout(60);
  await press([9]);
  await expect(pause).toBeHidden();
});
