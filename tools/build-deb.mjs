import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const runtime = join(root, "node_modules/electron/dist");
const electronVersion = JSON.parse(await readFile(join(root, "node_modules/electron/package.json"), "utf8")).version;
if (process.platform !== "linux") throw new Error("Build Debian packages on Linux with dpkg-deb installed.");
const architecture = execFileSync("dpkg", ["--print-architecture"], { encoding: "utf8" }).trim();
const machine = { amd64: 62, arm64: 183 }[architecture];
if (!machine) throw new Error(`Unsupported native Debian architecture: ${architecture}`);
const binary = await readFile(join(runtime, "electron"));
if (binary.subarray(0, 4).toString() !== "\x7fELF" || binary.readUInt16LE(18) !== machine) {
  throw new Error("The Electron runtime does not match the host architecture. Install the native runtime first.");
}
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error("A Debian release needs a stable x.y.z version.");
const epoch = Number(process.env.SOURCE_DATE_EPOCH ?? execFileSync("git", ["log", "-1", "--format=%ct"], { cwd: root, encoding: "utf8" }).trim());
if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error("SOURCE_DATE_EPOCH must be a nonnegative integer.");
const maintainer = `${pkg.author.name} <${pkg.author.email}>`;
if (/[\r\n]/.test(maintainer) || !pkg.author.email) throw new Error("Configure a package author name and email before releasing.");

const dependencies = [
  "libc6 (>= 2.31)", "libatomic1", "libgcc-s1", "libasound2t64 | libasound2",
  "libatk1.0-0t64 | libatk1.0-0", "libatk-bridge2.0-0t64 | libatk-bridge2.0-0",
  "libatspi2.0-0t64 | libatspi2.0-0", "libcairo2", "libcups2t64 | libcups2",
  "libdbus-1-3", "libexpat1", "libgbm1", "libglib2.0-0t64 | libglib2.0-0",
  "libgtk-3-0t64 | libgtk-3-0", "libnspr4", "libnss3", "libpango-1.0-0",
  "libudev1", "libx11-6", "libxcb1", "libxcomposite1", "libxdamage1",
  "libxext6", "libxfixes3", "libxkbcommon0", "libxrandr2",
];

async function files(directory, relative = "") {
  const result = [];
  for (const entry of (await readdir(join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await files(directory, path));
    else if (entry.isFile()) result.push(path);
    else throw new Error(`Unexpected symlink or special file in package: ${path}`);
  }
  return result;
}

async function write(path, body, mode = 0o644) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, { mode });
}

async function normalize(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await normalize(path);
    else {
      const mode = (await stat(path)).mode & 0o111 ? 0o755 : 0o644;
      await chmod(path, basename(path) === "chrome-sandbox" ? 0o4755 : mode);
      await utimes(path, epoch, epoch);
    }
  }
  await chmod(directory, 0o755);
  await utimes(directory, epoch, epoch);
}

const staging = await mkdtemp(join(tmpdir(), "eldrinth-deb-"));
const output = join(root, "release");
const filename = `eldrinth_${pkg.version}_${architecture}.deb`;
let pendingDirectory;
try {
  const application = join(staging, "usr/lib/eldrinth");
  const appRoot = join(application, "resources/app");
  const doc = join(staging, "usr/share/doc/eldrinth");
  await cp(runtime, application, { recursive: true });
  await rm(join(application, "resources/default_app.asar"), { force: true });
  await rename(join(application, "electron"), join(application, "eldrinth"));
  await cp(join(root, "dist"), join(appRoot, "dist"), { recursive: true });
  await mkdir(join(appRoot, "desktop"), { recursive: true });
  for (const name of ["main.cjs", "protocol.cjs", "window-state.cjs", "icon.png"]) {
    await cp(join(root, "desktop", name), join(appRoot, "desktop", name));
  }
  await write(join(appRoot, "package.json"), JSON.stringify({
    name: pkg.name, productName: pkg.productName, version: pkg.version,
    description: pkg.description, main: pkg.main, license: pkg.license,
  }, null, 2) + "\n");
  await write(join(staging, "usr/bin/eldrinth"), await readFile(join(root, "packaging/eldrinth")), 0o755);
  await write(join(staging, "usr/share/applications/eldrinth.desktop"), await readFile(join(root, "packaging/eldrinth.desktop")));
  await write(join(staging, "usr/share/metainfo/io.github.recursive_ai_dev.eldrinth.metainfo.xml"), await readFile(join(root, "packaging/io.github.recursive_ai_dev.eldrinth.metainfo.xml")));
  await write(join(staging, "usr/share/man/man6/eldrinth.6.gz"), gzipSync(await readFile(join(root, "packaging/eldrinth.6"))));
  await write(join(staging, "usr/share/icons/hicolor/scalable/apps/eldrinth.svg"), await readFile(join(root, "public/favicon.svg")));
  await write(join(staging, "usr/share/icons/hicolor/256x256/apps/eldrinth.png"), await readFile(join(root, "desktop/icon.png")));
  await write(join(doc, "copyright"), `${await readFile(join(root, "LICENSE"), "utf8")}\nElectron ${electronVersion}: see ELECTRON-LICENSE.\nChromium and bundled runtime licenses: /usr/lib/eldrinth/LICENSES.chromium.html\nBundled game library licenses: THIRD-PARTY-LICENSES.txt\n`);
  await write(join(doc, "ELECTRON-LICENSE"), await readFile(join(runtime, "LICENSE")));
  await write(join(doc, "README.md"), await readFile(join(root, "packaging/README.md")));
  await write(join(doc, "CHANGELOG.md"), await readFile(join(root, "CHANGELOG.md")));
  let licenses = "Libraries bundled with ELDRINTH\n";
  for (const name of ["react", "react-dom", "scheduler", "zustand", "clsx", "tailwind-merge", "sql.js", "tailwindcss"]) {
    const directory = join(root, "node_modules", name);
    const names = await readdir(directory);
    const license = names.find(file => /^(LICENSE|LICENCE|COPYING)(\..*)?$/i.test(file));
    if (!license) throw new Error(`Missing license notice for ${name}`);
    licenses += `\n=== ${name} ===\n${await readFile(join(directory, license), "utf8")}\n`;
  }
  await write(join(doc, "THIRD-PARTY-LICENSES.txt"), licenses);
  const changelog = `eldrinth (${pkg.version}) stable; urgency=medium\n\n  * Release ELDRINTH ${pkg.version}; see CHANGELOG.md for gameplay and desktop changes.\n\n -- ${maintainer}  ${new Date(epoch * 1000).toUTCString()}\n`;
  await write(join(doc, "changelog.Debian.gz"), gzipSync(changelog));
  const data = await files(staging);
  let size = 0;
  let checksums = "";
  for (const path of data) {
    const bytes = await readFile(join(staging, path));
    size += bytes.length;
    checksums += `${createHash("md5").update(bytes).digest("hex")}  ${path}\n`;
  }
  await write(join(staging, "DEBIAN/md5sums"), checksums);
  await write(join(staging, "DEBIAN/control"), [
    "Package: eldrinth", `Version: ${pkg.version}`, "Section: games", "Priority: optional",
    `Architecture: ${architecture}`, `Maintainer: ${maintainer}`, `Installed-Size: ${Math.ceil(size / 1024)}`,
    `Depends: ${dependencies.join(", ")}`, "Recommends: fonts-dejavu-core, libgl1",
    `Homepage: ${pkg.homepage}`, "Description: ELDRINTH - The Unbound Spire",
    " A dark fantasy action RPG with four frontier regions, nine shard fortresses,",
    " investigations and multiple endings. Includes its desktop runtime and",
    " runs offline. Saves are stored in the current user's configuration directory.", "",
  ].join("\n"));
  await normalize(staging);
  await mkdir(output, { recursive: true });
  const target = join(output, filename);
  // Keep the pending archive on the destination filesystem so final rename is
  // atomic even when /tmp is a separate mount.
  pendingDirectory = await mkdtemp(join(output, ".build-"));
  const pending = join(pendingDirectory, filename);
  execFileSync("dpkg-deb", ["--root-owner-group", "--uniform-compression", "--threads-max=2", "-Zxz", "-z6", "--build", staging, pending], {
    stdio: "inherit", env: { ...process.env, SOURCE_DATE_EPOCH: String(epoch) },
  });
  const bytes = await readFile(pending);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(join(output, `${filename}.sha256`), `${sha256}  ${filename}\n`);
  await writeFile(join(output, `${filename}.json`), JSON.stringify({
    package: "eldrinth", version: pkg.version, architecture, electron: electronVersion,
    sourceDateEpoch: epoch, filename, bytes: bytes.length, sha256,
  }, null, 2) + "\n");
  await rename(pending, target);
  console.log(`Built ${target} (${(bytes.length / 1024 / 1024).toFixed(1)} MiB).`);
} finally {
  await rm(staging, { recursive: true, force: true });
  if (pendingDirectory) await rm(pendingDirectory, { recursive: true, force: true });
}
