const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { restoreWindowState, readWindowState, writeWindowState, checkpointWithTimeout } = require("./window-state.cjs");
const displays = [{ x: 0, y: 0, width: 1920, height: 1040 }, { x: -1280, y: 0, width: 1280, height: 720 }];

test("window restoration respects negative monitor coordinates and display modes", () => {
  assert.deepEqual(restoreWindowState({ x: -1200, y: 40, width: 1000, height: 600, maximized: true }, displays), {
    x: -1200, y: 40, width: 1000, height: 600, maximized: true, fullscreen: false,
  });
});

test("unplugged monitors and oversized or invalid bounds restore on screen", () => {
  assert.deepEqual(restoreWindowState({ x: 3000, y: -1000, width: 4000, height: 4000, fullscreen: true }, displays), {
    x: 0, y: 0, width: 1920, height: 1040, maximized: false, fullscreen: true,
  });
  const invalid = restoreWindowState({ x: null, y: 0, width: "large", height: 600 }, displays);
  assert.equal(invalid.width, 1280);
  assert.equal(invalid.x, 320);
  const tiny = restoreWindowState({ x: 0, y: 0, width: -1, height: -1 }, displays);
  assert.equal(tiny.width, 640);
  assert.equal(tiny.height, 360);
});

test("preferences survive a write and corrupt files fall back safely", () => {
  const directory = mkdtempSync(join(tmpdir(), "eldrinth-window-test-"));
  const path = join(directory, "window.json");
  try {
    writeWindowState(path, { getNormalBounds: () => ({ x: 10, y: 20, width: 800, height: 600 }), isMaximized: () => true, isFullScreen: () => false });
    assert.equal(JSON.parse(readFileSync(path, "utf8")).maximized, true);
    assert.equal(readWindowState(path, displays).x, 10);
    writeFileSync(path, "{damaged");
    assert.equal(readWindowState(path, displays).width, 1280);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("native close waits for checkpoints, propagates failure and bounds hangs", async () => {
  let completed = false;
  await checkpointWithTimeout(async () => { await Promise.resolve(); completed = true; });
  assert.equal(completed, true);
  await assert.rejects(checkpointWithTimeout(() => Promise.reject(new Error("Storage full"))), /Storage full/);
  await assert.rejects(checkpointWithTimeout(() => new Promise(() => {}), 10), /taking too long/);
});
