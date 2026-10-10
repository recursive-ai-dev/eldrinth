const { resolve, sep, extname } = require("node:path");

const SCHEME = "eldrinth";
const GAME_URL = `${SCHEME}://game/index.html`;

// The game keeps the browser's security boundary: no file:// access and no
// Node API in the renderer. A stable secure origin also preserves Web Locks
// and localStorage across restarts and package upgrades.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-src 'none'",
].join("; ");

function resolveAssetPath(input, root) {
  try {
    const url = new URL(input);
    if (url.protocol !== `${SCHEME}:` || url.hostname !== "game" || url.port || url.username || url.password) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes("\0") || pathname.includes("\\")) return null;
    const directory = resolve(root);
    const file = resolve(directory, "." + (pathname === "/" ? "/index.html" : pathname));
    return file.startsWith(directory + sep) ? file : null;
  } catch {
    return null;
  }
}

function isGameURL(input) {
  try {
    const url = new URL(input);
    return url.protocol === `${SCHEME}:` && url.host === "game" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function mimeType(file) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".wasm": "application/wasm",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
  })[extname(file)] ?? "application/octet-stream";
}

module.exports = { SCHEME, GAME_URL, CONTENT_SECURITY_POLICY, resolveAssetPath, isGameURL, mimeType };
