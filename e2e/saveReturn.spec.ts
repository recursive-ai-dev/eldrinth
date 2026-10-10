import { test, expect } from "@playwright/test";

test("save and return freezes loadout and resume keys until the selected weapon is persisted", async ({ page, context }) => {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto("/eldrinth/");
  const warning = page.getByRole("button", { name: "I UNDERSTAND" });
  if (await warning.isVisible()) await warning.click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("i");
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeVisible();
  const hammer = page.getByRole("button", { name: /^Gravehammer/ });
  const blade = page.getByRole("button", { name: /^Wayblade/ });
  await hammer.click();
  await expect(hammer).toHaveAttribute("aria-pressed", "true");

  // A real pending persistence lock exercises the asynchronous save boundary.
  await page.evaluate(() => {
    const pending = window as typeof window & { releaseSaveLock?: () => void; saveLockHeld?: boolean };
    void navigator.locks.request("eldrinth.sqlite.v1", async () => {
      await new Promise<void>(resolve => {
        pending.releaseSaveLock = resolve;
        pending.saveLockHeld = true;
      });
    });
  });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { saveLockHeld?: boolean }).saveLockHeld)).toBe(true);
  await page.getByRole("button", { name: "SAVE & RETURN TO TITLE" }).click();
  await expect(page.getByRole("button", { name: "SAVING RECORD…" })).toBeDisabled();
  await expect(blade).toBeDisabled();
  await expect(hammer).toBeDisabled();
  for (const key of ["i", "Escape", "p"]) {
    await page.keyboard.press(key);
    await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeVisible();
  }
  await page.evaluate(() => (window as typeof window & { releaseSaveLock?: () => void }).releaseSaveLock?.());
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeHidden();
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  // Loading starts after the asynchronous slot read. Wait for the new game to
  // mount before checking its overlay, or an absent overlay passes too early.
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("i");
  await expect(hammer).toHaveAttribute("aria-pressed", "true");
  await expect(blade).toBeEnabled();
});
