import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const architecture = execFileSync("dpkg", ["--print-architecture"], { encoding: "utf8" }).trim();
const file = process.argv[2] ? resolve(process.argv[2]) : join(root, "release", `eldrinth_${pkg.version}_${architecture}.deb`);
const sha256 = createHash("sha256").update(await readFile(file)).digest("hex");
assert.equal((await readFile(`${file}.sha256`, "utf8")).trim(), `${sha256}  ${basename(file)}`);
for (const [key, value] of [["Package", "eldrinth"], ["Version", pkg.version], ["Architecture", architecture]]) {
  assert.equal(execFileSync("dpkg-deb", ["--field", file, key], { encoding: "utf8" }).trim(), value);
}
const archive = execFileSync("dpkg-deb", ["--contents", file], { encoding: "utf8" });
assert.match(archive, /^-rwsr-xr-x root\/root .*\.\/usr\/lib\/eldrinth\/chrome-sandbox$/m);
assert.doesNotMatch(archive, /node_modules\/|default_app\.asar|\.map$/m);
const extracted = await mkdtemp(join(tmpdir(), "eldrinth-verify-deb-"));
try {
  execFileSync("dpkg-deb", ["--extract", file, extracted]);
  execFileSync("dpkg-deb", ["--control", file, join(extracted, "DEBIAN")]);
  assert.equal((await stat(join(extracted, "usr/bin/eldrinth"))).mode & 0o777, 0o755);
  assert.equal((await stat(join(extracted, "usr/lib/eldrinth/chrome-sandbox"))).mode & 0o7777, 0o4755);
  const launcher = await readFile(join(extracted, "usr/bin/eldrinth"), "utf8");
  assert.match(launcher, /^exec \/usr\/lib\/eldrinth\/eldrinth "\$@"$/m);
  assert.doesNotMatch(launcher, /--no-sandbox/);
  // Wayland-only desktops have no X server; without this flag Electron aborts at startup.
  assert.match(launcher, /--ozone-platform=wayland/);
  const appRoot = join(extracted, "usr/lib/eldrinth/resources/app");
  const manifest = JSON.parse(await readFile(join(appRoot, "package.json"), "utf8"));
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.main, "desktop/main.cjs");
  for (const path of ["dist/index.html", "desktop/main.cjs", "desktop/protocol.cjs", "desktop/icon.png"]) {
    assert.ok((await stat(join(appRoot, path))).size > 0, path);
  }
  const checksums = (await readFile(join(extracted, "DEBIAN/md5sums"), "utf8")).trim().split("\n");
  for (const line of checksums) {
    const [expected, path] = line.split("  ");
    assert.equal(createHash("md5").update(await readFile(join(extracted, path))).digest("hex"), expected, path);
  }
  console.log(`Verified ${basename(file)}: metadata, checksums, desktop assets and sandbox permissions.`);
} finally {
  await rm(extracted, { recursive: true, force: true });
}
