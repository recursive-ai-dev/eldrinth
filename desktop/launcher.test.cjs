const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

// Runs packaging/eldrinth with the real binary swapped for a stub that prints its arguments.
function launch(env, args = []) {
  const dir = mkdtempSync(join(tmpdir(), "eldrinth-launcher-"));
  try {
    const stub = join(dir, "stub");
    writeFileSync(stub, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
    chmodSync(stub, 0o755);
    const source = readFileSync(join(__dirname, "../packaging/eldrinth"), "utf8");
    assert.ok(source.includes("/usr/lib/eldrinth/eldrinth"), "launcher no longer execs the packaged binary");
    const script = join(dir, "eldrinth");
    writeFileSync(script, source.replace("/usr/lib/eldrinth/eldrinth", stub));
    const result = spawnSync("/bin/sh", [script, ...args], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.split("\n").filter(Boolean);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a Wayland-only session names the Wayland platform, before user arguments", () => {
  assert.deepEqual(launch({ WAYLAND_DISPLAY: "wayland-0" }, ["--foo"]), ["--ozone-platform=wayland", "--foo"]);
});

test("a session with a DISPLAY keeps Electron's own platform choice", () => {
  assert.deepEqual(launch({ WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" }, ["--foo"]), ["--foo"]);
  assert.deepEqual(launch({ DISPLAY: ":0" }), []);
});

test("a session with neither display variable passes arguments through untouched", () => {
  assert.deepEqual(launch({}, ["a b", "--c=d"]), ["a b", "--c=d"]);
});

test("an empty DISPLAY or WAYLAND_DISPLAY counts as unset", () => {
  assert.deepEqual(launch({ WAYLAND_DISPLAY: "wayland-0", DISPLAY: "" }), ["--ozone-platform=wayland"]);
  assert.deepEqual(launch({ WAYLAND_DISPLAY: "" }), []);
});
