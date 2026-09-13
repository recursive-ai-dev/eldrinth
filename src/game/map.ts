import { MAP_W, MAP_H, TILE, T } from "./constants";
import type { MapData, Vec, EnemySpawn, SignData, RegionExit, CampfireData } from "./types";

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

export function generateMap(regionId = "overworld"): MapData {
  if (regionId !== "overworld") return generateFrontierMap(regionId);
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
      if (fine[i] > 0.7 && rng() < 0.45) tiles[i] = T.TREE;
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
  for (let i = 0; i < 48; i++) {
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
      if (fine[i] > 0.82 && rng() < 0.35) tiles[i] = T.ROCK;
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
    for (let o = -2; o <= 2; o++) {
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
  carve(62, 61, 62, 69); // south road to the Moonlit Coast
  carve(78, 55, 96, 56); // east road to the Cinderwild
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
  for (let i = 0; i < 26; i++) {
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
      title: "A Traveller's Primer",
      text: "MOVE  WASD / Arrows · ATTACK  J / Space · DASH  Shift · SPEAK / READ  E · JOURNAL  L · PAUSE  Esc. The Watcher keeps the hall in Ilyarael: this road east to the junction, then south past the wayfire into the ruin. Write down what you find. Nobody else is going to.",
    },
    {
      x: 33,
      y: 35,
      title: "Inscription at Ilyarael",
      text: "Here stood Ilyarael. Orithel keeps the hall through this northern doorway. A scout left three sightings before she stopped reporting: north along the western forest track; north of the mountain pass beyond the lake; and east of this approach, beneath an adept's watch.",
    },
    { x: 35, y: 41, title: "The Courier's Orders", fact: "courier-orders", text: "Deliver the vessel to the collector at the broken shrine northeast of the Cinderwild's central circle. Do not open it. Do not listen to it. Beneath the seal, in a hand that tore the paper: ‘It has a child's voice. I have read this four times looking for the part where this is something other than what it fucking is. It isn't there. It was never going to be there.’" },
    { x: 44, y: 13, title: "The Spire Warning", text: "Beyond the black ridge stands a glass tower. The old moon-road crosses the lake and keeps east. Those who followed it came back describing a sleeping thing. The ones who stayed and listened longer came back describing a crowd." },
    { x: 52, y: 16, title: "A Pilgrim's Correction", text: "The first Spire is empty. Its keeper went east past the old ward. The pale-stone road is surest; the southern ash road has fewer eyes on it, if that matters to you. It mattered to me." },
    { x: 64, y: 54, title: "Charred Surveyor's Page", text: "No fragments remain in the ash country — collected long ago, the ledger says, though it does not say by whom or on whose authority. At this junction the south road reaches Moonlit Coast; east past Moonfall Crossing lies the Cinderwild. Each frontier holds two. Both roads run on to the Starfall Moors, where the last pair went." },
    { x: 78, y: 55, title: "Moonfall Crossing", text: "East into the Cinderwild. North back toward the Spire. Nine fragments answer the ward: three in the Old Lands, two in each frontier — Cinderwild, Moonlit Coast, Starfall Moors. Nine is not a natural number for a ward. Somebody asked for nine." },
    { x: 76, y: 22, title: "Offering Ledger", text: "Before entering Moonfall Reach, travellers left offerings at the fork north of the ash road. The last party took the eastern path. The ledger records their offering and their names, and then a second entry striking the names out, in a different hand, dated the same day." },
    { x: 79, y: 14, title: "The Last Ward", text: "Nine Anima Shards shall quiet the dreamer. No fewer. The ward does not point the way. It only remembers what was taken, which is the one thing everybody involved would rather it did not do." },
    { x: 96, y: 56, title: "East Road Marker", text: "The Cinderwild lies east: ash storms, broken shrines, no easy return. A tall stone circle at its heart, if the scouts were being honest." },
    { x: 62, y: 69, title: "South Road Marker", text: "Moonlit Coast lies south. Follow the salt wind to lands the old maps forgot, or were made to forget. A pale beacon burns where its roads meet." },
  ];
  const shards: Vec[] = [
    { x: px(18), y: px(12) },
    { x: px(50), y: px(9) },
    { x: px(40), y: px(34) },
  ];
  const enemySpawns: EnemySpawn[] = [
    { x: 16, y: 18, type: "wraith" },
    { x: 22, y: 7, type: "wraith" },
    { x: 48, y: 11, type: "sentinel" },
    { x: 56, y: 22, type: "adept" },
    { x: 42, y: 36, type: "adept" },
    // Sparse patrols create intentional encounters without sealing the roads.
    { x: 38, y: 51, type: "wraith" },
    { x: 60, y: 58, type: "adept" },
    { x: 70, y: 44, type: "sentinel" },
    { x: 84, y: 50, type: "wraith" },
    { x: 90, y: 34, type: "adept" },
    // Moonfall Reach has room to approach the final road deliberately.
    { x: 76, y: 19, type: "wraith" },
    { x: 93, y: 18, type: "adept" },
    { x: 40, y: 34, type: "adept", elite: true },
  ];

  return {
    regionName: "The Old Lands",
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
    exits: [
      { x: 96, y: 56, targetRegion: "cinderwild", destination: { x: px(7), y: px(38) }, label: "Cinderwild" },
      { x: 62, y: 69, targetRegion: "moonlit-coast", destination: { x: px(50), y: px(7) }, label: "Moonlit Coast" },
    ],
    campfires: [{ x: px(33), y: px(31), name: "Ilyarael's Last Ember", relic: "emberheart" }],
  };
}

/** Three large, seeded frontiers make the journey a world rather than one field. */
function generateFrontierMap(regionId: string): MapData {
  const configs: Record<string, { name: string; seed: number; water: boolean; exits: RegionExit[]; shardTiles: [number, number][]; relic: CampfireData["relic"] }> = {
    "cinderwild": {
      name: "The Cinderwild", seed: 0xc1d3a, water: false,
      exits: [
        { x: 3, y: 38, targetRegion: "overworld", destination: { x: px(94), y: px(56) }, label: "The Old Lands" },
        { x: 88, y: 66, targetRegion: "starfall-moors", destination: { x: px(12), y: px(8) }, label: "Starfall Moors" },
      ], shardTiles: [[72, 20], [84, 53]], relic: "ashstep",
    },
    "moonlit-coast": {
      name: "Moonlit Coast", seed: 0xbadc0de, water: true,
      exits: [
        { x: 50, y: 3, targetRegion: "overworld", destination: { x: px(62), y: px(67) }, label: "The Old Lands" },
        { x: 91, y: 50, targetRegion: "starfall-moors", destination: { x: px(12), y: px(58) }, label: "Starfall Moors" },
      ], shardTiles: [[24, 48], [78, 18]], relic: "tidewell",
    },
    "starfall-moors": {
      name: "The Starfall Moors", seed: 0x57a2fa11, water: false,
      exits: [
        { x: 8, y: 8, targetRegion: "cinderwild", destination: { x: px(86), y: px(64) }, label: "The Cinderwild" },
        { x: 8, y: 58, targetRegion: "moonlit-coast", destination: { x: px(89), y: px(50) }, label: "Moonlit Coast" },
      ], shardTiles: [[47, 35], [78, 42]], relic: "starblade",
    },
  };
  const config = configs[regionId];
  if (!config) throw new Error(`Unknown region: ${regionId}`);
  const rng = mulberry32(config.seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const noise = smoothNoise(rng, 7);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const n = noise[idx(x, y)];
    tiles[idx(x, y)] = n < .38 ? T.DGRASS : T.GRASS;
    if (n > .82 && rng() < .25) tiles[idx(x, y)] = config.water ? T.TALLGRASS : T.ROCK;
    if (n < .14 && rng() < .35) tiles[idx(x, y)] = config.water ? T.SAND : T.TREE;
  }
  // Broad expedition roads leave room to observe, disengage, and choose fights.
  const road = (x: number, y: number) => { if (inB(x, y)) tiles[idx(x, y)] = T.PATH; };
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) for (let w = -2; w <= 2; w++) {
      const x = Math.round(x0 + (x1 - x0) * i / steps);
      const y = Math.round(y0 + (y1 - y0) * i / steps);
      road(x + (Math.abs(x1 - x0) > Math.abs(y1 - y0) ? 0 : w), y + (Math.abs(x1 - x0) > Math.abs(y1 - y0) ? w : 0));
    }
  };
  const hub: [number, number] = [50, 36];
  for (const exit of config.exits) line(exit.x, exit.y, hub[0], hub[1]);
  for (const [x, y] of config.shardTiles) line(hub[0], hub[1], x, y);
  // Landmark circle gives each map a discoverable centre and a combat clearing.
  for (let y = 27; y <= 45; y++) for (let x = 40; x <= 60; x++) {
    const d = Math.hypot(x - hub[0], y - hub[1]);
    if (d < 7) tiles[idx(x, y)] = T.SPIREFLOOR;
    else if (d < 9 && tiles[idx(x, y)] !== T.PATH) tiles[idx(x, y)] = T.ROCK;
  }
  for (const exit of config.exits) for (let y = exit.y - 2; y <= exit.y + 2; y++) for (let x = exit.x - 2; x <= exit.x + 2; x++) road(x, y);
  const signs: SignData[] = config.exits.map((exit) => ({ x: exit.x, y: exit.y, title: "Road of Wayfarers", text: `The road leads toward ${exit.label}. Old wheel-ruts, mostly. They run deeper going east than coming back, which tells you what the traffic was and which direction it was carrying.` }));
  const surveys: Record<string, string> = {
    cinderwild: "This is the Cinder Circle. The northeast track ends at a broken shrine — a fragment there, and a vessel that was never delivered. The southeast track ends at a ruined watchpost, where a warden still holds a second fragment and has forgotten why it is holding anything. The long road southeast reaches the Starfall Moors.",
    "moonlit-coast": "At this pale circle: southwest to the salt graves and a fragment; northeast to the keeper's beacon, where a warden watches the second. The graves are the older road and much the better lit, which is not an accident. The eastern road reaches the Starfall Moors.",
    "starfall-moors": "The fallen observatory lies northwest of this wayfire, inside the stone ring; a fragment sits among its records. The road east, sloping slightly south, ends at the astronomer's guardian and the last fragment. The northwest road returns to the Cinderwild, the southwest to Moonlit Coast.",
  };
  signs.push({ x: 50, y: 39, title: `${config.name} Survey`, text: surveys[regionId] });
  const records: Record<string, SignData[]> = {
    cinderwild: [
      { x: 72, y: 20, title: "The Broken Shrine", fact: "courier-memory", text: "A courier's shell, curled around a vessel the size of a fist. She got this far and could not finish, so she spent herself keeping it warm instead — nine hundred years of her, for this. The thing inside is still awake. It has been awake the entire time. It asks, very politely, whether it is going to be allowed to stop. I copy every word into my journal because I do not trust myself to carry it accurately." },
      { x: 84, y: 53, title: "The Ruined Watchpost", text: "The southern watch fell defending a fragment, and the warden still walks its circuit around an empty post. It does not know the post is empty. Beyond these fields the southeastern road descends into the Starfall Moors." },
    ],
    "moonlit-coast": [
      { x: 24, y: 48, title: "The Salt Graves", fact: "salt-graves", text: "No bodies. Only names, scraped down to the stone. The evacuation ledger says the last boat left half empty, and every passenger who did not board carries the same mark in the margin — the intake mark, though the ledger does not call it that. RECONCILED — 41. TRANSFERRED TO COLLECTION — 39. And underneath, in the same clerk's unhurried hand, a note that the remainder, being already struck from the rolls, were not counted out, and that whatever the collectors did with them on the road was not a matter the harbour was obliged to record, a person who does not exist being incapable of complaint. Another account survives at the beacon northeast of the pale circle." },
      { x: 78, y: 18, title: "The Keeper's Beacon", fact: "salt-beacon", text: "‘I chose. Someone had to choose and I was the one standing there. Forty went on that boat who would not have gone otherwise. I know exactly what that cost and I have never once pretended the arithmetic was clean.’ He is reasonable for eleven pages, and signed every one of them. By the ninth I had started nodding along, and that frightened me worse than the graves did. Orithel would know what to do with this." },
    ],
    "starfall-moors": [
      { x: 47, y: 35, title: "The Fallen Observatory", fact: "dawn-record", text: "‘One dawn, forever’ is what the plaque says, and what the funding said. The working notes say something else. The lens was an intake prototype and he tested it on himself, deliberately, to demonstrate the process was survivable at scale. He wrote down the moment he understood that it was not. He kept writing for a considerable time after. His guardian waits at the end of the eastern track, just south of east from the wayfire." },
      { x: 78, y: 42, title: "The Astronomer's Watch", text: "The guardian's casing carries the observatory seal, stamped into the metal the way equipment is stamped. Something is burning inside it and has not been permitted to stop burning. It will not leave the road while the shell holds." },
    ],
  };
  signs.push(...records[regionId]);
  // Authored, walkable landmark clearings preserve the roads to every clue.
  for (const [x, y] of config.shardTiles) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) tiles[idx(x + dx, y + dy)] = config.water ? T.SAND : T.RFLOOR;
    tiles[idx(x - 3, y - 3)] = config.water ? T.GRAVE : T.RWALL;
    tiles[idx(x + 3, y - 3)] = config.water ? T.GRAVE : T.RWALL;
    tiles[idx(x, y - 3)] = T.CRYSTAL;
  }
  const enemySpawns: EnemySpawn[] = [];
  const openGround = (tile: number) => tile === T.GRASS || tile === T.DGRASS || tile === T.TALLGRASS || tile === T.SAND;
  let attempts = 0;
  while (enemySpawns.length < 6 && attempts++ < 400) {
    const x = 8 + Math.floor(rng() * 84), y = 7 + Math.floor(rng() * 58);
    if (!openGround(tiles[idx(x, y)])) continue;
    if (Math.hypot(x - hub[0], y - hub[1]) < 12) continue;
    if (config.shardTiles.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 7)) continue;
    if (enemySpawns.some((spawn) => Math.hypot(x - spawn.x, y - spawn.y) < 16)) continue;
    const i = enemySpawns.length;
    enemySpawns.push({ x, y, type: i % 5 === 0 ? "adept" : i % 3 === 0 ? "sentinel" : "wraith" });
  }
  const [eliteX, eliteY] = config.shardTiles[1];
  enemySpawns.push({ x: eliteX + 2, y: eliteY + 2, type: regionId === "cinderwild" ? "sentinel" : "adept", elite: true });
  return {
    regionName: config.name, width: MAP_W, height: MAP_H, tiles, wardTiles: [],
    spawn: { x: px(50), y: px(36) }, npc: { x: -9999, y: -9999 }, signs,
    shards: config.shardTiles.map(([x, y]) => ({ x: px(x), y: px(y) })), enemySpawns,
    bossCenter: { x: px(50), y: px(36) }, exits: config.exits,
    campfires: [{ x: px(50), y: px(36), name: `${config.name} Wayfire`, relic: config.relic }],
  };
}
