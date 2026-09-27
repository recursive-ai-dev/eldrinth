import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const dist = resolve(import.meta.dirname, "../dist");
const files = await readdir(join(dist, "assets"));
for (const [label, suffix] of [["JavaScript", ".js"], ["CSS", ".css"], ["region worker", ".worker.js"], ["SQLite WASM", ".wasm"]]) {
  if (!files.some((name) => suffix === ".worker.js" ? name.startsWith("region.worker-") && name.endsWith(".js") : name.endsWith(suffix))) {
    throw new Error(`Release bundle is missing ${label}.`);
  }
}

const index = await readFile(join(dist, "index.html"), "utf8");
const links = [...index.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => !/^https?:\/\//.test(url));
if (!links.some((url) => url.endsWith(".js")) || !links.some((url) => url.endsWith(".css"))) {
  throw new Error("Release page has no application script or stylesheet.");
}
if (links.some((url) => !url.startsWith("./"))) {
  throw new Error("Release page contains a path that cannot work under a nested deployment.");
}

const mime = (name) => name.endsWith(".js") ? "text/javascript" :
  name.endsWith(".css") ? "text/css" :
  name.endsWith(".wasm") ? "application/wasm" :
  name.endsWith(".svg") ? "image/svg+xml" :
  name.endsWith(".png") ? "image/png" :
  name.endsWith(".jpg") ? "image/jpeg" : "text/html";
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!path.startsWith("/eldrinth/")) { response.writeHead(404).end(); return; }
  const local = resolve(dist, path.slice("/eldrinth/".length) || "index.html");
  if (local !== dist && !local.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(local);
    response.writeHead(200, { "content-type": mime(local) }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/eldrinth/`;
  for (const url of ["./", ...links, ...files.map((name) => `./assets/${name}`)]) {
    const response = await fetch(new URL(url, base));
    if (!response.ok || !(await response.arrayBuffer()).byteLength) {
      throw new Error(`Release asset failed under nested path: ${url} (${response.status})`);
    }
  }
  console.log("Release bundle passed nested-path asset checks.");
} finally {
  server.close();
}
