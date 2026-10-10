import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

async function openJournal(page: Page) {
  await page.goto("/eldrinth/");
  const warning = page.getByRole("button", { name: "I UNDERSTAND" });
  if (await warning.isVisible()) await warning.click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await page.keyboard.press("l");
  await expect(page.locator("#journal-note")).toBeVisible();
}

test("journal filters, trimmed observations, guide progress, and text export", async ({ page }) => {
  await openJournal(page);
  const note = page.locator("#journal-note");
  const write = page.getByRole("button", { name: "WRITE", exact: true });
  await note.fill("   ");
  await expect(write).toBeDisabled();
  await note.fill("  Follow the north road.  ");
  await expect(page.locator("#journal-note-count")).toContainText("26 / 1200");
  await note.press("Control+Enter");
  await expect(note).toHaveValue("");
  await expect(page.getByText("Follow the north road.", { exact: true })).toBeVisible();
  await expect(page.getByText("Observation added to your journal.", { exact: true })).toBeVisible();

  await page.getByRole("combobox", { name: "Record status" }).selectOption("open");
  await expect(page.getByText(/No records match your filters/)).toBeVisible();
  await page.getByRole("button", { name: "Show all records", exact: true }).click();
  await page.getByRole("combobox", { name: "Record status" }).selectOption("personal");
  await page.getByRole("searchbox", { name: "Search journal", exact: true }).fill("ROAD north");
  await expect(page.getByText("Follow the north road.", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("eldrinth-field-journal.txt");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString("utf8")).toContain("Follow the north road.");

  await page.getByRole("button", { name: "Field guide", exact: true }).click();
  await expect(page.getByText("1 of 6 first steps recorded")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search field guide" }).fill("Gravehammer");
  await expect(page.getByRole("heading", { name: "Gravehammer", exact: true })).toBeVisible();
  await expect(page.getByText(/1 entry across all sections/)).toBeVisible();
  await page.getByRole("button", { name: "Lamplight", exact: true }).click();
  await expect(page.locator(".guide-card")).toHaveCount(4);
  const firstHint = page.locator(".guide-route").first();
  await expect(firstHint).not.toHaveAttribute("open", "");
  await firstHint.locator("summary").click();
  await expect(firstHint).toHaveAttribute("open", "");
  await expect(firstHint.locator("p")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`journal guide remains usable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openJournal(page);
    await page.locator("#journal-note").fill("The cup is still here.");
    await page.locator("#journal-note").press("Control+Enter");
    const record = page.getByText("The cup is still here.", { exact: true });
    await record.scrollIntoViewIfNeeded();
    await expect(record).toBeInViewport({ ratio: 0.95 });
    await page.getByRole("button", { name: "Field guide", exact: true }).click();
    await page.getByRole("button", { name: "Expeditions", exact: true }).click();
    const last = page.locator(".guide-route summary").last();
    await last.click();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport({ ratio: 0.95 });
    expect(await page.locator(".journal-panel").evaluate(panel => panel.scrollWidth <= panel.clientWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Records", exact: true }).click();
    const note = page.locator("#journal-note");
    await note.scrollIntoViewIfNeeded();
    await expect(note).toBeInViewport({ ratio: 0.95 });
    await note.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}
