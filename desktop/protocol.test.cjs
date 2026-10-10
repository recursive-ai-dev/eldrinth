const { test } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { GAME_URL, resolveAssetPath, isGameURL, mimeType } = require("./protocol.cjs");

test("the desktop origin resolves entry, worker and WASM assets inside its bundle", () => {
  const root = "/tmp/eldrinth-dist";
  assert.equal(resolveAssetPath(GAME_URL, root), join(root, "index.html"));
  assert.equal(resolveAssetPath("eldrinth://game/", root), join(root, "index.html"));
  assert.equal(resolveAssetPath("eldrinth://game/assets/region.worker-123.js", root), join(root, "assets/region.worker-123.js"));
  assert.equal(resolveAssetPath("eldrinth://game/assets/sql-wasm.wasm?cache=1", root), join(root, "assets/sql-wasm.wasm"));
  assert.equal(mimeType("worker.js"), "text/javascript; charset=utf-8");
  assert.equal(mimeType("sql-wasm.wasm"), "application/wasm");
});

test("asset requests cannot escape the bundle or switch origins", () => {
  for (const input of [
    "file:///etc/passwd", "https://game/index.html", "eldrinth://other/index.html",
    "eldrinth://user@game/index.html", "eldrinth://game:443/index.html",
    "eldrinth://game/%2e%2e%2fsecret", "eldrinth://game/%2f..%2fsecret",
    "eldrinth://game/%5c..%5csecret", "eldrinth://game/%00", "eldrinth://game/%zz",
  ]) assert.equal(resolveAssetPath(input, "/tmp/eldrinth-dist"), null, input);
});

test("only the local game origin can navigate the desktop window", () => {
  assert.equal(isGameURL(GAME_URL), true);
  for (const input of ["https://example.com/", "javascript:alert(1)", "eldrinth://user@game/", "eldrinth://game.evil/", "eldrinth://game:443/"]) {
    assert.equal(isGameURL(input), false);
  }
});
