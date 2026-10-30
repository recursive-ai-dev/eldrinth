import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";

async function importFile(page: Page, slot: number, contents: Buffer) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: `Import backup into slot ${slot}`, exact: true }).click();
  await (await chooser).setFiles({ name: "pilgrimage.json", mimeType: "application/json", buffer: contents });
}

test("exports a pilgrimage, imports into an empty slot and resumes its journal", async ({ page, context }) => {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto("/eldrinth/");
  await page.getByRole("button", { name: "I UNDERSTAND" }).click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("l");
  await page.locator("#journal-note").fill("Carry this observation to another pilgrimage.");
  await page.getByRole("button", { name: "WRITE", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "SAVE & RETURN TO TITLE" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export slot 1", exact: true }).click();
  const download = await downloadEvent;
  const contents = await readFile((await download.path())!);
  expect(JSON.parse(contents.toString()).format).toBe("eldrinth-pilgrimage");
  const beforeImport = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  await importFile(page, 2, Buffer.from('{"format":"eldrinth-pilgrimage","version":1,"world":{"version":4}}'));
  await expect(page.getByTestId("slot-error")).toContainText("not a valid ELDRINTH");
  expect(await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"))).toBe(beforeImport);
  await importFile(page, 2, contents);
  await expect(page.getByRole("button", { name: /^SLOT 2/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /^SLOT 1/ })).toBeEnabled();
  await page.getByRole("button", { name: /^SLOT 2/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("l");
  await expect(page.getByText("Carry this observation to another pilgrimage.", { exact: true })).toBeVisible();
});

test("erasing a record requires confirmation and can be cancelled", async ({ page, context }) => {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto("/eldrinth/");
  await page.getByRole("button", { name: "I UNDERSTAND" }).click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "SAVE & RETURN TO TITLE" }).click();
  await page.getByRole("button", { name: "Erase slot 1", exact: true }).click();
  await expect(page.getByRole("button", { name: /^SLOT 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm erase", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Erase slot 1", exact: true }).click();
  await page.getByRole("button", { name: "Confirm erase", exact: true }).click();
  await expect(page.getByRole("button", { name: /^SLOT 1/ })).toHaveCount(0);
});
