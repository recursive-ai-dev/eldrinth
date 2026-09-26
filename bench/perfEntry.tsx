import { Profiler } from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import App from "../src/App";
import { Game } from "../src/game/engine";
import { renderGame, __stageHook } from "../src/game/render/renderer";
import { slotStore } from "../src/game/slots";
import { silentCallbacks } from "../src/game/headlessGame";

declare global { interface Window { __perf: Record<string, unknown>; __commits: number } }
window.__perf = {};
window.__commits = 0;
const mode = new URLSearchParams(location.search).get("mode");

const REGIONS = ["overworld", "cinderwild", "moonlit-coast", "starfall-moors", "fortress.old-lands-vault"];

async function renderBench() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:1280px;height:720px;display:block";
  document.getElementById("root")!.appendChild(canvas);
  const game = new Game(canvas, silentCallbacks());
  await game.init();
  const ctx = game.ctx;
  const out: Record<string, unknown> = {};
  for (const region of REGIONS) {
    if (game.world.regionId !== region) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (game as any).changeRegion({ x: 0, y: 0, targetRegion: region, destination: { x: 0, y: 0 }, label: region });
    }
    // Spawn point of each region is where a player actually stands.
    const spots = region === "overworld" ? [[game.player.x, game.player.y], [game.map.width * 16, game.map.height * 16]] : [[game.map.width * 16, game.map.height * 16]];
    for (const [x, y] of spots) {
      game.player.x = x; game.player.y = y; game.centerCam();
      for (let i = 0; i < 120; i++) { renderGame(game); ctx.getImageData(0, 0, 1, 1); }
      const times: number[] = [];
      for (let i = 0; i < 400; i++) {
        const t = performance.now();
        renderGame(game);
        ctx.getImageData(0, 0, 1, 1); // force the 2D raster to flush so the cost is real
        times.push(performance.now() - t);
      }
      times.sort((a, b) => a - b);
      const stages: Record<string, number> = {};
      let last = 0;
      __stageHook.fn = (name) => { ctx.getImageData(0, 0, 1, 1); const now = performance.now(); if (name !== "pre") stages[name] = (stages[name] ?? 0) + now - last; last = now; };
      for (let i = 0; i < 200; i++) renderGame(game);
      __stageHook.fn = undefined;
      for (const k in stages) stages[k] = +(stages[k] / 200).toFixed(3);
      out[`${region}:stages`] = stages;
      out[`${region}@${Math.round(x)},${Math.round(y)}`] = { mean: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3), p50: +times[200].toFixed(3), p95: +times[380].toFixed(3) };
    }
  }
  if (new URLSearchParams(location.search).get("profile")) {
    await game.init();
    game.player.x = game.map.width * 16; game.player.y = game.map.height * 16; game.centerCam();
    window.__perf.profiling = true;
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < 1500; i++) { renderGame(game); ctx.getImageData(0, 0, 1, 1); }
    window.__perf.profiled = true;
    await new Promise((r) => setTimeout(r, 300));
  }
  // Checkpoint save as the app performs it every 10s.
  const snap = game.saveWorld();
  await slotStore.save(1, snap); await slotStore.save(2, snap);
  const st: number[] = [];
  for (let i = 0; i < 40; i++) { const t = performance.now(); await slotStore.save(1, game.saveWorld()); st.push(performance.now() - t); }
  st.sort((a, b) => a - b);
  out.save = { mean: +(st.reduce((a, b) => a + b, 0) / st.length).toFixed(3), p95: +st[38].toFixed(3), localStorageBytes: localStorage.getItem("eldrinth.sqlite.v1")?.length };
  game.destroy();
  window.__perf = out;
  window.__perf.done = true;
}

function appBench() {
  createRoot(document.getElementById("root")!).render(
    <Profiler id="app" onRender={() => { window.__commits++; }}><App /></Profiler>,
  );
  window.__perf.done = true;
}

if (mode === "render") void renderBench().catch((e) => { window.__perf = { error: String(e?.stack ?? e), done: true }; });
else appBench();
