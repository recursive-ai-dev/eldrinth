import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, symlink, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron } from "playwright";
import { expect } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const architecture = execFileSync("dpkg", ["--print-architecture"], { encoding: "utf8" }).trim();
const temporary = await mkdtemp(join(tmpdir(), "eldrinth-desktop-smoke-"));
const extracted = join(temporary, "package");
const profile = join(temporary, "profile");
let application;
const errors = [];
const remoteRequests = [];

async function launch(executablePath) {
  const env = { ...process.env, ELDRINTH_USER_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  // An extracted helper is owned by the test user. Use the kernel's namespace
  // sandbox there; an installed package can use its root-owned setuid helper.
  const args = process.env.ELDRINTH_DESKTOP_EXECUTABLE || process.env.ELDRINTH_DESKTOP_SANDBOX_HELPER ? [] : ["--disable-setuid-sandbox"];
  // Match the packaged launcher when testing the runtime binary directly.
  if (env.WAYLAND_DISPLAY && !env.DISPLAY) args.unshift("--ozone-platform=wayland");
  application = await _electron.launch({ executablePath, args, env, chromiumSandbox: true, timeout: 30_000 });
  application.context().on("request", request => {
    if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
  });
  const page = await application.firstWindow();
  page.on("pageerror", error => errors.push(error.message));
  const warning = page.getByRole("button", { name: "I UNDERSTAND" });
  await expect(page.locator("#root")).not.toBeEmpty();
  if (await warning.isVisible()) await warning.click();
  await expect(page.getByText("Reading saved records…")).toBeHidden();
  await expect(page.getByRole("heading", { name: "ELDRINTH", exact: true })).toBeVisible();
  assert.deepEqual(await application.evaluate(({ app, BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      packaged: app.isPackaged,
      sandbox: preferences.sandbox,
      isolation: preferences.contextIsolation,
      nodeIntegration: preferences.nodeIntegration,
      profile: app.getPath("userData"),
    };
  }), { packaged: true, sandbox: true, isolation: true, nodeIntegration: false, profile });
  assert.deepEqual(await page.evaluate(() => ({
    secure: isSecureContext,
    locks: typeof navigator.locks?.request,
    node: typeof window.require,
    origin: location.origin,
  })), { secure: true, locks: "function", node: "undefined", origin: "eldrinth://game" });
  return page;
}

async function closeNormally() {
  const closed = application.waitForEvent("close", { timeout: 15_000 });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed;
  application = undefined;
}

async function note(page, value) {
  await page.keyboard.press("l");
  await page.locator("#journal-note").pressSequentially(value);
  await page.getByRole("button", { name: "WRITE", exact: true }).click();
  await expect(page.getByText(value, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
}

try {
  const executablePath = process.env.ELDRINTH_DESKTOP_EXECUTABLE || join(extracted, "usr/lib/eldrinth/eldrinth");
  if (!process.env.ELDRINTH_DESKTOP_EXECUTABLE) {
    execFileSync("dpkg-deb", ["--extract", join(root, "release", `eldrinth_${pkg.version}_${architecture}.deb`), extracted]);
    if (process.env.ELDRINTH_DESKTOP_SANDBOX_HELPER) {
      // Ubuntu may disallow unprivileged namespaces. Reuse an already installed
      // root-owned helper only when it exactly matches the packaged runtime.
      const helper = resolve(process.env.ELDRINTH_DESKTOP_SANDBOX_HELPER);
      const packagedHelper = join(extracted, "usr/lib/eldrinth/chrome-sandbox");
      const metadata = await stat(helper);
      assert.equal(metadata.uid, 0, "Sandbox helper must be root-owned");
      assert.equal(metadata.mode & 0o7777, 0o4755, "Sandbox helper must have mode 4755");
      assert.deepEqual(await readFile(helper), await readFile(packagedHelper), "Sandbox helper must match the packaged Electron version");
      await unlink(packagedHelper);
      await symlink(helper, packagedHelper);
    }
  }
  let page = await launch(executablePath);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 740));
  await page.getByRole("button", { name: "BEGIN NEW PILGRIMAGE" }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("persistence-warning")).toHaveCount(0);
  await page.keyboard.press("i");
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Gravehammer/ }).click();
  await expect(page.getByRole("button", { name: /Gravehammer/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Display", exact: true }).click();
  const cameraZoom = page.getByRole("slider", { name: "Camera zoom" });
  await expect(cameraZoom).toHaveValue("1.5");
  await cameraZoom.focus();
  await cameraZoom.press("End");
  await cameraZoom.press("ArrowLeft");
  await expect(cameraZoom).toHaveValue("1.75");
  await page.keyboard.press("Escape");
  await note(page, "Saved by closing the desktop window");
  // Do not wait for the ten-second autosave; exercise the actual close path.
  await closeNormally();

  page = await launch(executablePath);
  assert.deepEqual(await application.evaluate(({ BrowserWindow }) => {
    const { width, height } = BrowserWindow.getAllWindows()[0].getNormalBounds();
    return { width, height };
  }), { width: 1100, height: 740 });
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("i");
  await expect(page.getByRole("button", { name: /Gravehammer/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Display", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Camera zoom" })).toHaveValue("1.75");
  await page.keyboard.press("Escape");
  await page.keyboard.press("l");
  await expect(page.getByText("Saved by closing the desktop window", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const original = await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1"));
  await note(page, "Unsaved after quota failure");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreStorageForSmoke = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  });
  await application.evaluate(({ dialog }) => {
    globalThis.eldrinthSaveFailureDialogCount = 0;
    dialog.showMessageBox = async () => {
      globalThis.eldrinthSaveFailureDialogCount++;
      return { response: 0, checkboxChecked: false };
    };
  });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await expect.poll(() => application.evaluate(() => globalThis.eldrinthSaveFailureDialogCount)).toBe(1);
  assert.equal(page.isClosed(), false);
  await expect(page.getByTestId("persistence-warning")).toContainText("storage is full");
  assert.equal(await page.evaluate(() => localStorage.getItem("eldrinth.sqlite.v1")), original);
  await page.evaluate(() => window.restoreStorageForSmoke());
  await closeNormally();

  page = await launch(executablePath);
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("l");
  await expect(page.getByText("Unsaved after quota failure", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "RESUME", exact: true }).click();
  await expect(page.getByRole("heading", { name: "PAUSED", exact: true })).toBeHidden();
  await note(page, "Saved by returning to the title");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "SAVE & RETURN TO TITLE", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ELDRINTH", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("l");
  await expect(page.getByText("Saved by returning to the title", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteRequests, []);
  await application.evaluate(({ dialog, BrowserWindow }) => {
    globalThis.eldrinthCrashDialogCount = 0;
    dialog.showMessageBox = async () => {
      globalThis.eldrinthCrashDialogCount++;
      return { response: 0, checkboxChecked: false };
    };
    BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer();
  });
  await expect.poll(() => application.evaluate(() => globalThis.eldrinthCrashDialogCount)).toBe(1);
  await expect(page.getByRole("heading", { name: "ELDRINTH", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /SLOT 1/ }).click();
  await expect(page.getByTestId("hud-vitals")).toBeVisible();
  await expect(page.getByTestId("loading-screen")).toBeHidden();
  await page.keyboard.press("l");
  await expect(page.getByText("Saved by returning to the title", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await closeNormally();
  console.log("Desktop package passed: offline launch, secure saves, loadout/camera/window persistence, journal, close/reopen, quota recovery, save/return and renderer crash recovery.");
} finally {
  if (application) {
    // Only the test process and its temporary profile are discarded on failure.
    const child = application.process();
    const exited = child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise(resolve => child.once("exit", resolve));
    await application.evaluate(({ app }) => app.exit(1)).catch(() => { child.kill("SIGKILL"); });
    await exited;
  }
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
