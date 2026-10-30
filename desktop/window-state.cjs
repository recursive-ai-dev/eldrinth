const { readFileSync, writeFileSync, renameSync } = require("node:fs");

// Keep a restored window reachable after unplugging a monitor or changing DPI.
function restoreWindowState(saved, displays) {
  const primary = displays[0] ?? { x: 0, y: 0, width: 1280, height: 800 };
  const valid = saved && ["x", "y", "width", "height"].every(key => Number.isSafeInteger(saved[key]));
  const area = valid ? displays.find(display =>
    saved.x < display.x + display.width && saved.x + saved.width > display.x &&
    saved.y < display.y + display.height && saved.y + saved.height > display.y) ?? primary : primary;
  const width = Math.min(area.width, Math.max(640, valid ? saved.width : 1280));
  const height = Math.min(area.height, Math.max(360, valid ? saved.height : 800));
  return {
    width, height,
    x: Math.max(area.x, Math.min(valid ? saved.x : area.x + Math.floor((area.width - width) / 2), area.x + area.width - width)),
    y: Math.max(area.y, Math.min(valid ? saved.y : area.y + Math.floor((area.height - height) / 2), area.y + area.height - height)),
    maximized: saved?.maximized === true,
    fullscreen: saved?.fullscreen === true,
  };
}

function readWindowState(path, displays) {
  let saved;
  try { saved = JSON.parse(readFileSync(path, "utf8")); } catch { /* First launch or damaged preferences. */ }
  return restoreWindowState(saved, displays);
}

function writeWindowState(path, window) {
  const state = { ...window.getNormalBounds(), maximized: window.isMaximized(), fullscreen: window.isFullScreen() };
  try {
    writeFileSync(`${path}.tmp`, JSON.stringify(state) + "\n", { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  } catch (error) { console.warn("Window preferences could not be saved:", error.message); }
}

async function checkpointWithTimeout(checkpoint, timeoutMs = 10_000) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(checkpoint),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Saving is taking too long. You can keep playing and try again.")), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

module.exports = { restoreWindowState, readWindowState, writeWindowState, checkpointWithTimeout };
