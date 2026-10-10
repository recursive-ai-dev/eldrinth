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
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
}

test("Last Breath spends stamina and returns to a ready guard", async ({ page }) => {
  await begin(page);
  const stamina = page.getByRole("progressbar", { name: "Stamina", exact: true });
  const guard = page.getByTestId("hud-guard");
  await expect(guard).toHaveAttribute("data-state", "ready");
  const before = Number(await stamina.getAttribute("aria-valuenow"));
  await page.keyboard.press("f");
  await expect.poll(async () => Number(await stamina.getAttribute("aria-valuenow"))).toBeLessThan(before);
  await expect(guard).toHaveAttribute("data-state", /^(guarding|recovering)$/);
  await expect(guard).toHaveAttribute("data-state", "ready");
  await expect(stamina).toHaveAttribute("aria-valuenow", String(before));
});

test("Names introduces the carried-person record before the first taking", async ({ page }) => {
  await begin(page);
  await page.keyboard.press("i");
  await page.getByRole("button", { name: /^names$/i }).click();
  const names = page.getByRole("region", { name: "The names you carry" });
  await expect(names).toBeVisible();
  await expect(names.getByText("0 carried · 0 heard at the fire", { exact: true })).toBeVisible();
  await expect(names.getByText("There is nobody else in your breathing. Yet.", { exact: true })).toBeVisible();
  await expect(names.getByRole("listitem")).toHaveCount(0);
  await expect(names).toContainText("the cost is stated before you choose");
  await page.screenshot({ path: test.info().outputPath("names-before-the-first-taking.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeHidden();
});

test("sound volume and mute survive a saved pilgrimage and reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await begin(page);
  await page.keyboard.press("i");
  await page.getByRole("button", { name: /^sound$/i }).click();
  const mute = page.getByRole("button", { name: "Mute music and sound", exact: true });
  const volume = page.getByRole("slider", { name: "Volume", exact: true });
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await volume.press("Home");
  for (let i = 0; i < 4; i++) await volume.press("ArrowRight");
  await expect(volume).toHaveValue("20");
  await page.getByRole("button", { name: "SAVE & RETURN TO TITLE", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ELDRINTH", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("i");
  await page.getByRole("button", { name: /^sound$/i }).click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toHaveText("Muted");
  await expect(volume).toHaveValue("20");
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`touch parry is reachable and spends stamina at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, baseURL: "http://127.0.0.1:4173/eldrinth/" });
    try {
      await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
      const page = await context.newPage();
      await begin(page);
      const parry = page.getByRole("button", { name: "Parry", exact: true });
      const stamina = page.getByRole("progressbar", { name: "Stamina", exact: true });
      await expect(parry).toBeInViewport({ ratio: 1 });
      const before = Number(await stamina.getAttribute("aria-valuenow"));
      await parry.tap();
      await expect.poll(async () => Number(await stamina.getAttribute("aria-valuenow"))).toBeLessThan(before);
      await expect(page.getByTestId("hud-guard")).toHaveAttribute("data-state", /^(guarding|recovering)$/);
    } finally {
      await context.close();
    }
  });
}
