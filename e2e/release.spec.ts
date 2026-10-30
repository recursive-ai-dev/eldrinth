import { test, expect, type Page } from "@playwright/test";

// Fonts are optional; exercise the documented offline fallback and keep the
// release gate independent of external font servers.
test.beforeEach(async ({ context }) => {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

async function title(page: Page) {
  await page.goto("/eldrinth/");
  const warning = page.getByRole("button", { name: "I UNDERSTAND" });
  if (await warning.isVisible()) await warning.click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
}
async function begin(page: Page) {
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
}
async function note(page: Page, text: string) {
  await page.keyboard.press("l");
  await page.locator("#journal-note").pressSequentially(text);
  await page.getByRole("button", { name: "WRITE", exact: true }).click();
  await page.keyboard.press("Escape");
}
async function checkpoint(page: Page) {
  const before = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  // Exercise the same event path as hiding a tab, without waiting ten seconds
  // per assertion or depending on headless window-manager behaviour.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    window.dispatchEvent(new Event("visibilitychange"));
    delete (document as unknown as { visibilityState?: string }).visibilityState;
  });
  return before;
}
async function save(page: Page) {
  const before = await checkpoint(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"))).not.toBe(before);
}
async function continueSlot(page: Page, slot: number) {
  await page.getByRole("button", { name: new RegExp(`SLOT ${slot}`) }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
}

test("production journal editing, save/reload, pause and restart", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await title(page); await begin(page);
  await page.keyboard.press("l");
  const input = page.locator("#journal-note");
  await input.pressSequentially("north road");
  await expect(input).toHaveValue("north road");
  await input.press("ArrowLeft");
  await input.pressSequentially("X");
  await expect(input).toHaveValue("north roaXd");
  await input.press("Control+Enter");
  await expect(input).toHaveValue("");
  await expect(page.getByText("north roaXd", { exact: true })).toBeVisible();
  await input.press("Escape");
  await save(page);
  await page.reload();
  await continueSlot(page, 1);
  await page.keyboard.press("l");
  await expect(page.getByText("north roaXd", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeVisible();
  // Space activates the focused native Resume button instead of attacking.
  await page.getByRole("button", { name: "RESUME", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeHidden();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "ABANDON & RESTART" }).click();
  await page.getByTestId("abandon-confirm").click();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("l");
  await expect(page.getByText("north roaXd", { exact: true })).toBeHidden();
  expect(errors).toEqual([]);
});

test("a delayed database never exposes existing saves as empty slots", async ({ page, context }) => {
  await title(page); await begin(page); await note(page, "Keep this record"); await save(page);
  const original = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  const slow = await context.newPage();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await slow.route("**/*.wasm", async route => { await gate; await route.continue(); });
  try {
    await slow.goto("/eldrinth/", { waitUntil: "domcontentloaded" });
    await expect(slow.getByText("Reading saved records…")).toBeVisible();
    await expect(slow.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" })).toBeDisabled();
    await expect(slow.getByText("EMPTY", { exact: true })).toHaveCount(0);
    await slow.keyboard.press("Enter");
    await expect(slow.getByRole("button", { name: /skip/i })).toHaveCount(0);
    release();
    await expect(slow.getByRole("button", { name: /SLOT 1/ })).toBeEnabled();
    expect(await slow.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"))).toBe(original);
  } finally { release(); }
});

test("two tabs retain separate slots and reject stale saves to the same slot", async ({ page, context }) => {
  await title(page); await begin(page); await note(page, "First pilgrim"); await save(page);
  const other = await context.newPage();
  await title(other); await begin(other); await note(other, "Second pilgrim"); await save(other);
  await note(page, "First keeps walking"); await save(page);
  await other.reload();
  await expect(other.getByRole("button", { name: /SLOT 1/ })).toBeEnabled();
  await expect(other.getByRole("button", { name: /SLOT 2/ })).toBeEnabled();
  await continueSlot(other, 1);
  await note(page, "Newest progress"); await save(page);
  await note(other, "Stale progress"); await checkpoint(other);
  await expect(other.getByTestId("slot-error")).toContainText("changed in another tab");
  await other.reload(); await continueSlot(other, 1);
  await other.keyboard.press("l");
  await expect(other.getByText("Newest progress", { exact: true })).toBeVisible();
  await expect(other.getByText("Stale progress", { exact: true })).toBeHidden();
});

test("a failed storage write warns and preserves the last persisted record", async ({ page }) => {
  await title(page); await begin(page); await note(page, "Persisted note"); await save(page);
  const original = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "eldrinth.sqlite.v1") throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await note(page, "Unsaved note"); await checkpoint(page);
  await expect(page.getByTestId("persistence-warning")).toContainText("storage is full");
  expect(await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"))).toBe(original);
  await page.reload(); await continueSlot(page, 1); await page.keyboard.press("l");
  await expect(page.getByText("Persisted note", { exact: true })).toBeVisible();
  await expect(page.getByText("Unsaved note", { exact: true })).toBeHidden();
});

test("a failed erase keeps the record visible and can be retried", async ({ page }) => {
  await title(page); await begin(page); await note(page, "Keep until erase reaches disk"); await save(page);
  await page.reload();
  await expect(page.getByRole("button", { name: /^SLOT 1/ })).toBeVisible();
  const original = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    (window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = set; };
    Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  });
  await page.getByRole("button", { name: "Erase slot 1" }).click();
  await page.getByRole("button", { name: "Confirm erase", exact: true }).click();
  await expect(page.getByTestId("slot-error")).toContainText("storage is full");
  await expect(page.getByRole("button", { name: /^SLOT 1/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"))).toBe(original);
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.getByRole("button", { name: "Erase slot 1" }).click();
  await page.getByRole("button", { name: "Confirm erase", exact: true }).click();
  await expect(page.getByRole("button", { name: /^SLOT 1/ })).toHaveCount(0);
  await expect(page.getByTestId("slot-error")).toHaveCount(0);
  await expect(page.getByTestId("persistence-warning")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /^SLOT 1/ })).toHaveCount(0);
});

test("browsers without safe cross-tab locking leave stored records untouched", async ({ page, context }) => {
  await title(page); await begin(page); await save(page);
  const original = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  const unsupported = await context.newPage();
  await unsupported.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  await title(unsupported);
  await expect(unsupported.getByTestId("persistence-warning")).toContainText("Safe saving is unavailable");
  await continueSlot(unsupported, 1);
  await checkpoint(unsupported);
  await expect(unsupported.getByTestId("slot-error")).toContainText("Existing records have been left untouched");
  expect(await unsupported.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"))).toBe(original);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
  test(`touch actions and nonoverlapping HUD at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, baseURL: "http://127.0.0.1:4173/eldrinth/" });
    try {
      await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
      const page = await context.newPage();
      await title(page);
      const button = page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport({ ratio: 1 });
      await begin(page);
      for (const name of ["Pause", "Journal"]) {
        await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
      }
      const vitals = (await page.getByTestId("hud-vitals").boundingBox())!;
      const objective = (await page.getByTestId("hud-objective").boundingBox())!;
      await expect(page.getByTestId("hud-vitals")).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId("hud-objective")).toBeInViewport({ ratio: 1 });
      expect(vitals.x + vitals.width <= objective.x || objective.x + objective.width <= vitals.x ||
        vitals.y + vitals.height <= objective.y || objective.y + objective.height <= vitals.y).toBe(true);
      const panels = [".hud-vitals", ".hud-objective", ".hud-foes", ".touch-shortcuts", ".touch-movement", ".touch-actions"];
      const boxes = await Promise.all(panels.map(selector => page.locator(selector).boundingBox()));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
          `${panels[i]} overlaps ${panels[j]}`).toBe(true);
      }
      await page.screenshot({ path: test.info().outputPath("touch-game.png") });
      await page.getByRole("button", { name: "Journal", exact: true }).tap();
      await expect(page.locator("#journal-note")).toBeVisible();
      await page.getByRole("button", { name: "ESC / L / CLOSE" }).tap();
      await page.getByRole("button", { name: "Pause", exact: true }).tap();
      await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "RESUME", exact: true }).tap();
      await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    } finally { await context.close(); }
  });
}

test("equipment, camera preferences and journal search survive save and return", async ({ page }) => {
  await title(page); await begin(page);
  await note(page, "The north road remembers");
  await page.keyboard.press("i");
  await page.getByRole("button", { name: /Gravehammer/ }).click();
  await expect(page.getByRole("button", { name: /Gravehammer/ })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/eldrinth-equipment.png" });
  await page.getByRole("button", { name: "Display", exact: true }).click();
  const zoom = page.getByRole("slider", { name: "Camera zoom" });
  await expect(zoom).toHaveValue("1.5");
  await zoom.focus(); await page.keyboard.press("End");
  await expect(zoom).toHaveValue("2");
  await page.getByRole("checkbox", { name: /Larger reading text/ }).check();
  await page.getByRole("checkbox", { name: /Quiet interface/ }).check();
  await zoom.press("Escape");
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeHidden();
  await page.screenshot({ path: "test-results/eldrinth-camera.png" });
  await page.keyboard.press("l");
  await page.getByRole("searchbox", { name: "Search journal" }).fill("north road");
  await expect(page.getByText("The north road remembers", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search journal" }).fill("no-such-record");
  await expect(page.getByText(/No records match/)).toBeVisible();
  await page.getByRole("searchbox", { name: "Search journal" }).press("Escape");
  await page.keyboard.press("i");
  await page.getByRole("button", { name: "SAVE & RETURN TO TITLE" }).click();
  await expect(page.getByRole("heading", { name: "ELDRINTH", exact: true })).toBeVisible();
  await page.reload(); await continueSlot(page, 1);
  await page.keyboard.press("i");
  await expect(page.getByRole("button", { name: /Gravehammer/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Display", exact: true }).click();
  await expect(zoom).toHaveValue("2");
  await expect(page.getByRole("checkbox", { name: /Larger reading text/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Quiet interface/ })).toBeChecked();
  await expect(page.locator(".app-root")).toHaveClass(/large-reading.*quiet-interface/);
});

test("save and return stays in the game when persistence fails", async ({ page }) => {
  await title(page); await begin(page); await save(page);
  const stored = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "eldrinth.sqlite.v1") throw new DOMException("Full", "QuotaExceededError");
      set.call(this, key, value);
    };
  });
  await page.keyboard.press("i");
  await page.getByRole("button", { name: "SAVE & RETURN TO TITLE" }).click();
  await expect(page.getByTestId("persistence-warning")).toContainText("storage is full");
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "RESUME", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"))).toBe(stored);
});

test("compact journal keeps search, records and note writing reachable", async ({ page }) => {
  await title(page); await begin(page);
  await note(page, "Follow the ash road to the water drum.");
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.keyboard.press("l");
    const search = page.getByRole("searchbox", { name: "Search journal" });
    await search.fill("ash road");
    const record = page.getByText("Follow the ash road to the water drum.", { exact: true });
    await record.scrollIntoViewIfNeeded();
    await expect(record).toBeInViewport({ ratio: 1 });
    const input = page.locator("#journal-note");
    await input.scrollIntoViewIfNeeded();
    // Fractional dvh/scroll positions can clip less than one CSS pixel.
    await expect(input).toBeInViewport({ ratio: 0.95 });
    await page.screenshot({ path: `test-results/eldrinth-journal-${viewport.width}.png` });
    await input.fill("The cup is still there.");
    await input.press("Control+Enter");
    await expect(input).toHaveValue("");
    await input.press("Escape");
    await expect(page.getByRole("dialog", { name: /Notes, Cores/ })).toHaveCount(0);
  }
});
