import { MAP_W, MAP_H, TILE, T } from "./constants";
import type { MapData, Vec, EnemySpawn, SignData } from "./types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const idx = (x: number, y: number) => y * MAP_W + x;
const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const px = (t: number) => t * TILE + TILE / 2;

// Smooth value-noise for organic patches of terrain.
function smoothNoise(rng: () => number, scale: number): Float32Array {
  const gw = Math.ceil(MAP_W / scale) + 2;
  const gh = Math.ceil(MAP_H / scale) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const out = new Float32Array(MAP_W * MAP_H);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const gx = x / scale;
      const gy = y / scale;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const tx = sm(gx - x0);
      const ty = sm(gy - y0);
      const a = g[y0 * gw + x0];
      const b = g[y0 * gw + x0 + 1];
      const c = g[(y0 + 1) * gw + x0];
      const d = g[(y0 + 1) * gw + x0 + 1];
      out[idx(x, y)] = lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    }
  }
  return out;
}

export function generateMap(): MapData {
  const rng = mulberry32(0x9e3779b1);
  const tiles = new Uint8Array(MAP_W * MAP_H);

  const patches = smoothNoise(rng, 8);
  const fine = smoothNoise(rng, 4);

  // Base grass with darker patches
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = idx(x, y);
      tiles[i] = patches[i] < 0.42 ? T.DGRASS : T.GRASS;
    }
  }

  // ----- The Weeping Forest (west region) -----
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < 22; x++) {
      const i = idx(x, y);
      const dSpawn = Math.hypot(x - 10, y - 26);
      if (dSpawn < 4.5) continue; // keep the starting clearing open
      if (fine[i] > 0.52 && rng() < 0.8) tiles[i] = T.TREE;
    }
  }

  // ----- The Murkwater lake -----
  const lx = 38;
  const ly = 14;
  const lrx = 8;
  const lry = 4;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const d = Math.hypot((x - lx) / lrx, (y - ly) / lry);
      if (d < 1) tiles[idx(x, y)] = T.WATER;
      else if (d < 1.25 && tiles[idx(x, y)] !== T.WATER) tiles[idx(x, y)] = T.SAND;
    }
  }

  // ----- Mountain barrier (full height, with a pass) -----
  for (let y = 0; y < MAP_H; y++) {
    if (y >= 12 && y <= 16) continue; // the pass
    for (let x = 45; x <= 47; x++) tiles[idx(x, y)] = T.ROCK;
  }
  for (let i = 0; i < 130; i++) {
    const x = 43 + Math.floor(rng() * 6);
    const y = Math.floor(rng() * MAP_H);
    if (y >= 11 && y <= 17) continue;
    if (inB(x, y) && tiles[idx(x, y)] !== T.WATER) tiles[idx(x, y)] = T.ROCK;
  }

  // ----- Ruins of Ilyarael (the fallen elven hall) -----
  const hall = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) tiles[idx(x, y)] = T.RFLOOR;
    for (let x = x0; x <= x1; x++) {
      tiles[idx(x, y0)] = T.RWALL;
      tiles[idx(x, y1)] = T.RWALL;
    }
    for (let y = y0; y <= y1; y++) {
      tiles[idx(x0, y)] = T.RWALL;
      tiles[idx(x1, y)] = T.RWALL;
    }
  };
  hall(28, 36, 37, 43);
  tiles[idx(33, 36)] = T.RFLOOR; // north entrance
  tiles[idx(32, 39)] = T.RFLOOR;

  // ----- The old Glass Spire, now a silent waypoint -----
  const cx = 60;
  const cy = 13;
  for (let y = 6; y <= 20; y++) {
    for (let x = 52; x <= 68; x++) {
      if (!inB(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= 6) tiles[idx(x, y)] = T.SPIREFLOOR;
      else if (d <= 8.4) tiles[idx(x, y)] = T.ROCK;
    }
  }
  tiles[idx(54, 12)] = T.SPIREFLOOR;
  tiles[idx(54, 13)] = T.SPIREFLOOR;
  tiles[idx(54, 14)] = T.SPIREFLOOR;
  // ----- The Moonfall Reach and the true Spire -----
  // The old arena remains as a visual landmark. The Unbound has retreated to
  // the far eastern reach, turning the final act into a real journey.
  const trueSpireX = 88;
  const trueSpireY = 14;
  for (let y = 5; y <= 23; y++) {
    for (let x = 78; x <= 98; x++) {
      const d = Math.hypot(x - trueSpireX, y - trueSpireY);
      if (d <= 7) tiles[idx(x, y)] = T.SPIREFLOOR;
      else if (d <= 9.3) tiles[idx(x, y)] = T.ROCK;
    }
  }
  // A one-tile gate preserves the ward as an actual gate rather than a
  // decoration that can be walked around.
  for (let x = 77; x <= 80; x++) tiles[idx(x, 14)] = T.SPIREFLOOR;
  const wardTiles = [idx(79, 13), idx(79, 14), idx(79, 15)];
  for (const wi of wardTiles) tiles[wi] = T.SPIREFLOOR;
  const wardSet = new Set(wardTiles);

  // ----- Ashen Expanse (south) -----
  for (let y = 50; y < MAP_H; y++) {
    for (let x = 18; x < 82; x++) {
      const i = idx(x, y);
      if (patches[i] < 0.5) tiles[i] = T.DGRASS;
      if (fine[i] > 0.72 && rng() < 0.55) tiles[i] = T.ROCK;
    }
  }
  // A broken moon-water inlet makes the southern route feel distinct.
  for (let y = 57; y <= 65; y++) for (let x = 82; x <= 98; x++) {
    if (Math.hypot((x - 91) / 10, (y - 62) / 5) < 1) tiles[idx(x, y)] = T.WATER;
  }

  // ----- Roads / paths -----
  const setPath = (x: number, y: number) => {
    if (!inB(x, y) || wardSet.has(idx(x, y))) return;
    const cur = tiles[idx(x, y)];
    if (cur === T.WATER) tiles[idx(x, y)] = T.BRIDGE;
    else if (cur === T.RWALL) tiles[idx(x, y)] = T.RFLOOR;
    else tiles[idx(x, y)] = T.PATH;
  };
  const stamp = (x: number, y: number, horizontal: boolean) => {
    for (let o = -1; o <= 1; o++) {
      const sx = horizontal ? x : x + o;
      const sy = horizontal ? y + o : y;
      setPath(sx, sy);
    }
  };
  const carve = (x0: number, y0: number, x1: number, y1: number) => {
    const h = Math.min(x0, x1);
    const H = Math.max(x0, x1);
    for (let x = h; x <= H; x++) stamp(x, y0, true);
    const v = Math.min(y0, y1);
    const V = Math.max(y0, y1);
    for (let y = v; y <= V; y++) stamp(x1, y, false);
  };
  carve(10, 26, 33, 26); // spawn -> main road
  carve(33, 26, 33, 14); // up toward the lake
  carve(33, 14, 53, 14); // east across the lake (bridge) toward the Spire
  carve(33, 26, 33, 36); // branch south into the ruins
  carve(18, 12, 18, 26); // shard 1 -> main road
  carve(50, 9, 50, 14); // shard 2 -> main road
  carve(33, 34, 40, 34); // shard 3 -> main road
  carve(53, 14, 79, 14); // old Spire -> Moonfall Reach
  carve(33, 43, 33, 54); // ruins -> Ashen Expanse
  carve(33, 54, 62, 54);
  carve(62, 54, 78, 55);
  carve(78, 55, 88, 49);
  carve(78, 55, 88, 30);
  carve(62, 54, 62, 61);
  carve(62, 54, 70, 42);
  carve(70, 42, 73, 22);

  // ----- Decoration -----
  const isGrass = (t: number) => t === T.GRASS || t === T.DGRASS;
  const crystalNear = (x: number, y: number) => {
    if (!inB(x, y) || !isGrass(tiles[idx(x, y)])) return;
    tiles[idx(x, y)] = T.CRYSTAL;
  };
  for (let i = 0; i < 26; i++) {
    crystalNear(26 + Math.floor(rng() * 16), 34 + Math.floor(rng() * 12));
    crystalNear(50 + Math.floor(rng() * 16), 6 + Math.floor(rng() * 16));
  }
  for (let i = 0; i < 230; i++) {
    const x = Math.floor(rng() * MAP_W);
    const y = Math.floor(rng() * MAP_H);
    if (isGrass(tiles[idx(x, y)]) && fine[idx(x, y)] > 0.46) tiles[idx(x, y)] = T.TALLGRASS;
  }
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rng() * MAP_W);
    const y = Math.floor(rng() * MAP_H);
    if (isGrass(tiles[idx(x, y)]) && rng() < 0.5) tiles[idx(x, y)] = T.FLOWER;
  }
  for (let i = 0; i < 24; i++) {
    const x = 3 + Math.floor(rng() * 18);
    const y = 2 + Math.floor(rng() * 22);
    if (isGrass(tiles[idx(x, y)])) tiles[idx(x, y)] = rng() < 0.5 ? T.GRAVE : T.BONES;
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * MAP_W);
    const y = Math.floor(rng() * MAP_H);
    if (isGrass(tiles[idx(x, y)]) && x > 22 && x < 44) tiles[idx(x, y)] = T.ROCK;
  }
  for (let y = 24; y <= 28; y++)
    for (let x = 8; x <= 12; x++)
      if (tiles[idx(x, y)] === T.TREE || tiles[idx(x, y)] === T.ROCK) tiles[idx(x, y)] = T.GRASS;

  // ----- Entities / points of interest -----
  const signs: SignData[] = [
    {
      x: 13,
      y: 27,
      text: "MOVE  WASD / Arrows      ATTACK  J / Space      DASH  Shift      SPEAK / READ  E      PAUSE  Esc",
    },
    {
      x: 33,
      y: 35,
      text: "Here stood Ilyarael, jewel of the Elder Elves. The Mnemonic tend it still... or what remains of them.",
    },
    { x: 44, y: 13, text: "BEYOND: the Glass Spire. The Unbound dreams within. Turn back, wayfarer." },
    { x: 52, y: 16, text: "The first Spire is empty. Follow the moon-road east: the Unbound has fled beyond the old ward." },
    { x: 64, y: 54, text: "ASHEN EXPANSE — Here the sky fell in burning fragments. Walk lightly; the Sundered hunt in packs." },
    { x: 78, y: 55, text: "MOONFALL CROSSING — Nine shards answer the true ward. Every recovered fragment strengthens the bearer." },
    { x: 76, y: 22, text: "Pilgrims left offerings here before entering Moonfall Reach. None returned after the last eclipse." },
    { x: 79, y: 14, text: "THE LAST WARD — Nine Anima Shards shall quiet the dreamer. No fewer." },
  ];
  const shards: Vec[] = [
    { x: px(18), y: px(12) },
    { x: px(50), y: px(9) },
    { x: px(40), y: px(34) },
    { x: px(70), y: px(42) },
    { x: px(78), y: px(55) },
    { x: px(88), y: px(49) },
    { x: px(88), y: px(30) },
    { x: px(73), y: px(22) },
    { x: px(62), y: px(61) },
  ];
  const enemySpawns: EnemySpawn[] = [
    { x: 16, y: 18, type: "wraith" },
    { x: 20, y: 10, type: "wraith" },
    { x: 13, y: 9, type: "wraith" },
    { x: 24, y: 20, type: "wraith" },
    { x: 18, y: 15, type: "wraith" },
    { x: 22, y: 6, type: "wraith" },
    { x: 48, y: 11, type: "sentinel" },
    { x: 42, y: 36, type: "sentinel" },
    { x: 36, y: 44, type: "sentinel" },
    { x: 40, y: 24, type: "sentinel" },
    { x: 44, y: 18, type: "adept" },
    { x: 34, y: 30, type: "adept" },
    { x: 56, y: 22, type: "adept" },
    // Ashen Expanse patrols
    { x: 38, y: 51, type: "wraith" },
    { x: 46, y: 56, type: "wraith" },
    { x: 53, y: 52, type: "sentinel" },
    { x: 60, y: 58, type: "adept" },
    { x: 68, y: 45, type: "sentinel" },
    { x: 70, y: 39, type: "adept" },
    { x: 73, y: 52, type: "wraith" },
    { x: 79, y: 53, type: "sentinel" },
    { x: 83, y: 48, type: "adept" },
    { x: 88, y: 43, type: "sentinel" },
    { x: 90, y: 34, type: "adept" },
    { x: 84, y: 28, type: "sentinel" },
    // Moonfall Reach guards its final road with a dense mixed patrol.
    { x: 76, y: 19, type: "wraith" },
    { x: 82, y: 24, type: "wraith" },
    { x: 74, y: 25, type: "adept" },
    { x: 91, y: 25, type: "sentinel" },
    { x: 93, y: 18, type: "adept" },
    { x: 82, y: 9, type: "sentinel" },
  ];

  return {
    width: MAP_W,
    height: MAP_H,
    tiles,
    wardTiles,
    spawn: { x: px(10), y: px(26) },
    npc: { x: px(32), y: px(39) },
    signs,
    shards,
    enemySpawns,
    bossCenter: { x: px(trueSpireX), y: px(trueSpireY) },
  };
}
