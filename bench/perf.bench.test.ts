import { beforeAll, it } from "vitest";
import { bootGame, installHeadlessDom } from "../src/game/headlessGame";
import { renderGame } from "../src/game/render/renderer";
import type { Game } from "../src/game/engine";

// Temporary measurement harness for the performance audit. Not part of the suite.
const REGIONS = ["overworld", "cinderwild", "moonlit-coast", "starfall-moors", "fortress.old-lands-vault"];

function countingCtx() {
  const counts: Record<string, number> = {};
  const noop = () => undefined;
  const ctx = new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === "__counts") return counts;
      if (prop === "canvas") return { width: 1280, height: 720 };
      if (prop === "imageSmoothingEnabled" || prop === "filter" || prop === "globalAlpha") return undefined;
      return (..._args: unknown[]) => {
        counts[prop] = (counts[prop] ?? 0) + 1;
        if (prop === "measureText") return { width: 10 };
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return { addColorStop: noop };
        return undefined;
      };
    },
    set: () => true,
  });
  return ctx as unknown as CanvasRenderingContext2D & { __counts: Record<string, number> };
}

async function goTo(game: Game, region: string) {
  if (game.world.regionId === region) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (game as any).changeRegion({ x: 0, y: 0, targetRegion: region, destination: { x: game.map.width * 16, y: game.map.height * 16 }, label: region });
  const ww = game.map.width * 16, hh = game.map.height * 16;
  game.player.x = ww; game.player.y = hh;
  game.centerCam();
}

beforeAll(() => installHeadlessDom());

it("render + simulate baseline", { timeout: 300000 }, async () => {
  const game = await bootGame();
  const rows: string[] = [];
  for (const region of REGIONS) {
    await goTo(game, region);
    for (let i = 0; i < 30; i++) game.simulateStep(1 / 60);
    const ctx = countingCtx();
    game.ctx = ctx;
    // warm-up (chunk rasterization)
    for (let i = 0; i < 60; i++) renderGame(game);
    for (const k of Object.keys(ctx.__counts)) delete ctx.__counts[k];
    const FRAMES = 2000;
    let t = performance.now();
    for (let i = 0; i < FRAMES; i++) { renderGame(game); }
    const renderMs = (performance.now() - t) / FRAMES;
    const c = ctx.__counts;
    const per = (k: string) => ((c[k] ?? 0) / FRAMES).toFixed(0);
    const calls = Object.values(c).reduce((a, b) => a + b, 0) / FRAMES;
    t = performance.now();
    for (let i = 0; i < FRAMES; i++) game.simulateStep(1 / 60);
    const simMs = (performance.now() - t) / FRAMES;
    const x0 = game.cam.x, y0 = game.cam.y, x1 = x0 + game.viewW, y1 = y0 + game.viewH;
    const onScreen = (x: number, y: number) => x > x0 - 64 && x < x1 + 64 && y > y0 - 64 && y < y1 + 64;
    const objs = [
      ...game.map.signs.map((s) => [s.x * 32, s.y * 32]),
      ...game.map.npcs.map((n) => [n.x, n.y]),
      ...game.map.campfires.map((f) => [f.x, f.y]),
      ...game.items.filter((i) => !i.taken).map((i) => [i.x, i.y]),
      ...game.enemies.map((e) => [e.x, e.y]),
    ];
    const vis = objs.filter(([x, y]) => onScreen(x, y)).length;
    const W = game.map.width;
    const ward = game.map.wardTiles.length;
    const wardVis = game.map.wardTiles.filter((wi) => onScreen((wi % W) * 32, Math.floor(wi / W) * 32)).length;
    rows.push(`${region.padEnd(26)} render=${renderMs.toFixed(3)}ms ctxCalls=${calls.toFixed(0)} gradients=${(+per("createRadialGradient") + +per("createLinearGradient"))} drawImage=${per("drawImage")} save=${per("save")} | sortedObjs=${objs.length} visible=${vis} ward=${ward} wardVisible=${wardVis} enemies=${game.enemies.length} | sim=${simMs.toFixed(4)}ms`);
  }
  console.log("\n" + rows.join("\n"));
  game.destroy();
});

it("save checkpoint baseline", { timeout: 300000 }, async () => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
  const { slotStore } = await import("../src/game/slots");
  const game = await bootGame();
  for (const r of REGIONS) await goTo(game, r); // visit regions so snapshot carries region state
  for (let i = 0; i < 600; i++) game.simulateStep(1 / 60);
  const snap = game.saveWorld();
  const w = (globalThis as any).window; delete (globalThis as any).window;
  await slotStore.save(1, snap); await slotStore.save(2, snap);
  (globalThis as any).window = w; // warm + fill two slots
  const N = 50;
  let tSnap = 0, tSave = 0;
  for (let i = 0; i < N; i++) {
    let t = performance.now();
    const s = game.saveWorld();
    tSnap += performance.now() - t;
    t = performance.now();
    await slotStore.save(1, s);
    tSave += performance.now() - t;
  }
  const json = JSON.stringify(snap).length;
  console.log(`\nSAVE snapshot=${(tSnap / N).toFixed(3)}ms slotStore.save=${(tSave / N).toFixed(3)}ms worldJson=${json}B localStorageValue=${store["eldrinth.sqlite.v1"].length}B`);
  let t = performance.now();
  for (let i = 0; i < N; i++) await slotStore.list();
  console.log(`LIST ${((performance.now() - t) / N).toFixed(3)}ms`);
});

it("save breakdown", { timeout: 300000 }, async () => {
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs({ locateFile: () => "./node_modules/sql.js/dist/sql-wasm.wasm" });
  const game = await bootGame();
  for (const r of REGIONS) await goTo(game, r);
  const snap = game.saveWorld();
  const db = new SQL.Database();
  db.run(`CREATE TABLE save_slots (id INTEGER PRIMARY KEY, difficulty TEXT, shards INTEGER, updated_at INTEGER, world_json TEXT)`);
  const N = 100; const acc = { stringify: 0, run: 0, export: 0, encode: 0 };
  let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array();
  for (let i = 0; i < N; i++) {
    let t = performance.now(); const j = JSON.stringify(snap); acc.stringify += performance.now() - t;
    t = performance.now(); db.run("INSERT OR REPLACE INTO save_slots VALUES (?,?,?,?,?)", [1 + (i % 2), "standard", 0, Date.now(), j]); acc.run += performance.now() - t;
    t = performance.now(); bytes = db.export(); acc.export += performance.now() - t;
    t = performance.now(); let out = ""; for (let k = 0; k < bytes.length; k += 0x8000) out += String.fromCharCode(...bytes.subarray(k, k + 0x8000)); btoa(out); acc.encode += performance.now() - t;
  }
  console.log("\nBREAKDOWN " + Object.entries(acc).map(([k, v]) => `${k}=${(v / N).toFixed(3)}ms`).join(" ") + ` dbBytes=${bytes.length}`);
});

it("chunk cache memory", { timeout: 300000 }, async () => {
  const game = await bootGame();
  const tr = (game as any).tileRenderer;
  for (let y = 0; y < game.map.height * 32; y += 256) for (let x = 0; x < game.map.width * 32; x += 256) {
    game.cam.x = x; game.cam.y = y; tr.drawGround(game.ctx, game.cam, game.viewW, game.viewH);
  }
  const chunks: any[] = [...tr.chunks.values()];
  const tall = (cx: number, cy: number) => { for (let y = cy * 16; y < Math.min(game.map.height, cy * 16 + 16); y++) for (let x = cx * 16; x < Math.min(game.map.width, cx * 16 + 16); x++) if ((game as any).map.tiles[y * game.map.width + x] !== undefined && (require_def(game.map.tiles[y * game.map.width + x]))) return true; return false; };
  const { tileDefinition } = await import("../src/game/constants");
  function require_def(t: number) { return tileDefinition(t).tall; }
  let withTall = 0;
  for (const key of tr.chunks.keys()) { const [cx, cy] = key.split(",").map(Number); if (tall(cx, cy)) withTall++; }
  const total = Math.ceil(game.map.width / 16) * Math.ceil(game.map.height / 16);
  console.log(`\nCHUNKS resident=${chunks.length}/${total} withTallTiles=${withTall} backingStoreMB(dpr1)=${(chunks.length * 2 * 512 * 512 * 4 / 1048576).toFixed(0)}`);
});
