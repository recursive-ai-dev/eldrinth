import { MAP_W, MAP_H, TILE, T } from "./constants";
import type { MapData, Vec, EnemySpawn, SignData, RegionExit, CampfireData, TownData, TownBuildingData, NpcData } from "./types";
import { parseFortressLayout } from "./fortress";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";

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

type FortressId = keyof typeof FORTRESS_LAYOUTS;

export type FortressTheme =
  | "timber"
  | "glass"
  | "vault"
  | "cinder"
  | "watchpost"
  | "salt"
  | "beacon"
  | "observatory"
  | "watch";

const FORTRESS_REGIONS = {
  "fortress.cinderwild-shrine": { name: "The Broken Shrine", returnTo: { region: "cinderwild", destination: { x: px(132), y: px(23) }, label: "the Cinderwild" } },
  "fortress.cinderwild-watchpost": { name: "The Ruined Watchpost", returnTo: { region: "cinderwild", destination: { x: px(142), y: px(79) }, label: "the Cinderwild" } },
  "fortress.old-lands-archive": { name: "The Weeping Archive", returnTo: { region: "overworld", destination: { x: px(24), y: px(19) }, label: "the Old Lands" } },
  "fortress.old-lands-reliquary": { name: "The Glass Reliquary", returnTo: { region: "overworld", destination: { x: px(96), y: px(15) }, label: "the Old Lands" } },
  "fortress.old-lands-vault": { name: "Ilyarael's Sealed Vault", returnTo: { region: "overworld", destination: { x: px(78), y: px(77) }, label: "the Old Lands" } },
  "fortress.moonlit-salt-graves": { name: "The Salt Graves", returnTo: { region: "moonlit-coast", destination: { x: px(28), y: px(89) }, label: "the Moonlit Coast" } },
  "fortress.moonlit-beacon": { name: "The Keeper's Beacon", returnTo: { region: "moonlit-coast", destination: { x: px(136), y: px(21) }, label: "the Moonlit Coast" } },
  "fortress.starfall-observatory": { name: "The Fallen Observatory", returnTo: { region: "starfall-moors", destination: { x: px(36), y: px(25) }, label: "the Starfall Moors" } },
  "fortress.starfall-watch": { name: "The Astronomer's Watch", returnTo: { region: "starfall-moors", destination: { x: px(142), y: px(63) }, label: "the Starfall Moors" } },
} satisfies Record<FortressId, { name: string; returnTo: { region: string; destination: Vec; label: string } }>;

/** A frontier gate always arrives one tile inside the destination door. */
function fortressExit(x: number, y: number, targetRegion: FortressId, label: string): RegionExit {
  const { door } = parseFortressLayout(FORTRESS_LAYOUTS[targetRegion]);
  return { x, y, targetRegion, destination: { x: px(door.x), y: px(door.y + 1) }, label };
}

/** A stable portrait slot stays with its NPC, rather than with a dialogue line. */
function townNpc(
  id: string,
  name: string,
  color: string,
  role: NpcData["role"],
  portraitId: string,
  portraitDescription: string,
): Omit<NpcData, "x" | "y"> {
  return { id, name, color, role, portrait: { id: portraitId, description: portraitDescription } };
}

/** The same residents are used by the exterior town directory and their interiors. */
export const TOWN_RESIDENTS = {
  "ilyarael-township": [
    townNpc("town:ilyarael:scrivener", "Scribe Althea", "#c9a86c", "lore", "scribe-althea", "A sharp-eyed archivist in an ochre hood, with silver hair pinned by a quill and ink-dark fingertips; a cracked ledger held close to her chest."),
    townNpc("town:ilyarael:healer", "Hollow Sister Mirene", "#8fcca8", "healer", "sister-mirene", "A solemn woman in a sea-green veil, her hands wrapped in linen and faintly lit from within; black-glass prayer beads at her throat."),
    townNpc("town:ilyarael:smith", "Barris the Smith", "#d4a373", "scout", "barris-the-smith", "A broad, scarred scavenger in a soot-stiff leather apron, with a cropped iron-grey beard, a broken sword over one shoulder, and a smith's hammer at his belt."),
  ],
  "cinder-haven": [
    townNpc("town:cinderwild:kilnmaster", "Kiln-Master Vance", "#ff8c52", "lore", "kiln-master-vance", "An elderly kiln tender with a copper half-mask, ember-orange goggles, and a charcoal cloak dusted in pale ash; he carries a tally hook like a cane."),
    townNpc("town:cinderwild:healer", "Cinder-Nurse Greta", "#f0a882", "healer", "cinder-nurse-greta", "A practical nurse with cropped dark curls beneath a singed linen cap, a rust-red coat, and sulfur-stained gloves; a blue glass water flask at her hip."),
    townNpc("town:cinderwild:outrunner", "Elodie the Outrunner", "#e0b084", "scout", "elodie-outrunner", "A wiry young outrunner in an ash-grey scarf and patched red climbing coat, with one shaved temple, a charcoal map case, and a hooked ravine staff."),
  ],
  "oarsmans-bight": [
    townNpc("town:moonlit:dredger", "Mistress Morveth", "#7ec4cf", "lore", "mistress-morveth", "An older dredger in an oilskin mantle the colour of storm water, with braided white hair, brass dive goggles, and name-tags sewn into every sleeve."),
    townNpc("town:moonlit:healer", "Sister Lyra of the Brine", "#9fe6d9", "healer", "sister-lyra", "A calm healer in layered kelp-green robes, with a shaved head, pearl ear cuffs, and a satchel of glass salve jars glowing through wet netting."),
    townNpc("town:moonlit:blind-oar", "Kieran the Blind Oar", "#a2c8e0", "scout", "kieran-blind-oar", "A weathered ferryman in a salt-bleached blue coat, eyes clouded by glare, with a long carved oar used as a walking staff and a rope coil across his chest."),
  ],
  "crater-watch": [
    townNpc("town:starfall:stargazer", "Reeve Toran", "#d6b4fc", "lore", "reeve-toran", "A gaunt stargazer in a violet wool mantle, with a brass monocle cracked across one eye, wind-tossed black hair, and a telescope lens cradled under one arm."),
    townNpc("town:starfall:healer", "Hermit Cassian", "#b39ddb", "healer", "hermit-cassian", "A soft-spoken hermit in a plum-coloured hooded coat, with a close silver beard, moss tucked into his sleeves, and a meteorite bowl of glowing spring water."),
    townNpc("town:starfall:drift-child", "Mina the Drift-Child", "#e2d0ff", "scout", "mina-drift-child", "A slight child in an oversized charcoal cloak sewn with meteor-glass beads, with pale braided hair, ink-dark eyes, and a tuning fork hanging from a cord."),
  ],
} satisfies Record<string, Omit<NpcData, "x" | "y">[]>;

const TOWN_PLACEMENTS = {
  "ilyarael-township": { regionId: "overworld", x: 68, y: 92 },
  "cinder-haven": { regionId: "cinderwild", x: 50, y: 70 },
  "oarsmans-bight": { regionId: "moonlit-coast", x: 86, y: 72 },
  "crater-watch": { regionId: "starfall-moors", x: 74, y: 72 },
} as const;

const TOWN_THEMES: Record<string, TownBuildingData["theme"]> = {
  "ilyarael-township": "oldstone",
  "cinder-haven": "cinder",
  "oarsmans-bight": "coastal",
  "crater-watch": "moor",
};

/** Hand-authored settlement layouts. A, B, and C are enterable building doors. */
const TOWN_LAYOUTS: Record<string, string[]> = {
  "ilyarael-township": [
    "#######################",
    "#.....................#",
    "#..HHH...HHH...HHH....#",
    "#..H.H...H.H...H.H....#",
    "#..HAH...HBH...HCH....#",
    "#.....................#",
    "#.......##............#",
    "D.......##............#",
    "#.....................#",
    "#######################",
  ],
  "cinder-haven": [
    "#######################",
    "#.....................#",
    "#..HHH........HHH.....#",
    "#..H.H..HHHH..H.H.....#",
    "#..HAH..H..H..HBH.....#",
    "#.......H..H..........#",
    "D.......H..H......HHH.#",
    "#.................HCH.#",
    "#.....................#",
    "#######################",
  ],
  "oarsmans-bight": [
    "#######################",
    "#.....................#",
    "#..HHH................#",
    "#..H.H........HHH.....#",
    "#..HAH........H.H.....#",
    "#.........H....HCH....#",
    "D.........H.H.........#",
    "#.........HBH.........#",
    "#.....................#",
    "#######################",
  ],
  "crater-watch": [
    "#######################",
    "#.....................#",
    "#.......HHH...........#",
    "#.......H.H...HHH.....#",
    "#.......HAH...H.H.....#",
    "#.............HB......#",
    "D.............HHH.....#",
    "#.............C.......#",
    "#.....................#",
    "#######################",
  ],
};

interface ParsedTown {
  width: number;
  height: number;
  door: Vec;
  buildingDoors: { glyph: "A" | "B" | "C"; x: number; y: number }[];
}

function parseTownLayout(id: string, rows: string[]): ParsedTown {
  if (rows.length === 0) throw new Error(`A town layout needs at least one row: ${id}`);
  const width = rows[0].length;
  const height = rows.length;
  for (const [y, row] of rows.entries()) {
    if (row.length !== width) throw new Error(`Town row ${y} has width ${row.length}, expected ${width} in ${id}`);
  }
  const door: Vec[] = [];
  const buildingDoors: ParsedTown["buildingDoors"] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const glyph = rows[y][x];
      if (!"#HDABC.".includes(glyph)) throw new Error(`Unknown town glyph "${glyph}" at ${x},${y} in ${id}`);
      if (glyph === "D") door.push({ x, y });
      if (glyph === "A" || glyph === "B" || glyph === "C") buildingDoors.push({ glyph, x, y });
    }
  }
  if (door.length !== 1) throw new Error(`Town ${id} needs exactly one door, found ${door.length}`);
  if (buildingDoors.length !== 3) throw new Error(`Town ${id} needs exactly three building doors, found ${buildingDoors.length}`);
  return { width, height, door: door[0], buildingDoors };
}

/** Stamp a town onto the tile grid and return its metadata for MapData.towns. */
function stampTown(
  tiles: Uint8Array,
  townId: string,
  worldX: number,
  worldY: number,
  npcs: Omit<NpcData, "x" | "y">[],
): TownData {
  const layout = parseTownLayout(townId, TOWN_LAYOUTS[townId]);
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const glyph = TOWN_LAYOUTS[townId][y][x];
      const tx = worldX + x;
      const ty = worldY + y;
      if (!inB(tx, ty)) continue;
      const i = idx(tx, ty);
      if (glyph === "#") tiles[i] = T.RWALL;
      // A cottage prop supplies the facade. This solid footprint preserves the
      // three-by-three house collision without drawing a repeated stone cube.
      else if (glyph === "H") tiles[i] = T.HOUSE_WALL;
      else if (glyph === "." || glyph === "D" || glyph === "A" || glyph === "B" || glyph === "C") tiles[i] = T.RFLOOR;
    }
  }
  const centerX = worldX + layout.width / 2;
  const centerY = worldY + layout.height / 2;
  // Covers the settlement footprint plus a one-tile buffer, but no further.
  const safeRadius = (Math.max(layout.width, layout.height) / 2 + 1) * TILE;
  const doorWorldX = worldX + layout.door.x;
  const doorWorldY = worldY + layout.door.y;
  // The sign sits one tile inward from the door so it is always on walkable floor.
  const inwardX = layout.door.x === 0 ? 1 : layout.door.x === layout.width - 1 ? -1 : 0;
  const inwardY = layout.door.y === 0 ? 1 : layout.door.y === layout.height - 1 ? -1 : 0;
  const buildings: TownBuildingData[] = layout.buildingDoors
    .sort((a, b) => a.glyph.localeCompare(b.glyph))
    .map((door, index) => {
      const resident = npcs[index];
      if (!resident) throw new Error(`Town ${townId} has a building without a matching resident.`);
      const suffix = door.glyph.toLowerCase();
      return {
        id: `${townId}-${suffix}`,
        name: townBuildingName(townId, index),
        x: worldX + door.x,
        y: worldY + door.y,
        theme: TOWN_THEMES[townId],
        interiorId: `interior.${townId}.${suffix}`,
        resident,
      };
    });
  const spots = TOWN_EXTERIOR_RESIDENT_SPOTS[townId] ?? [{ x: 5, y: 5 }, { x: 11, y: 6 }, { x: 17, y: 5 }];
  const exteriorNpcs: NpcData[] = npcs.map((resident, index) => {
    const spot = spots[index] ?? { x: 3 + index * 5, y: 5 };
    return {
      ...resident,
      x: px(worldX + spot.x),
      y: px(worldY + spot.y),
    };
  });
  const name = townId
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  return {
    id: townId,
    name,
    x: px(centerX),
    y: px(centerY),
    safeRadius,
    buildings,
    sign: {
      x: doorWorldX + inwardX,
      y: doorWorldY + inwardY,
      title: name,
      townId,
      text: "No enemies pursue past the threshold. Rest, speak, and read the road before you go.",
    },
    npcs: exteriorNpcs,
  };
}

const TOWN_EXTERIOR_RESIDENT_SPOTS: Record<string, [Vec, Vec, Vec]> = {
  "ilyarael-township": [{ x: 4, y: 8 }, { x: 14, y: 8 }, { x: 19, y: 6 }],
  "cinder-haven": [{ x: 4, y: 8 }, { x: 13, y: 7 }, { x: 19, y: 2 }],
  "oarsmans-bight": [{ x: 4, y: 8 }, { x: 7, y: 3 }, { x: 19, y: 7 }],
  "crater-watch": [{ x: 4, y: 3 }, { x: 4, y: 7 }, { x: 19, y: 3 }],
};

const TOWN_BUILDING_NAMES: Record<string, [string, string, string]> = {
  "ilyarael-township": ["Althea's Ledger Room", "The Hollow Sister's Cell", "Barris's Salvage Shop"],
  "cinder-haven": ["Vance's Kiln Office", "Greta's Cooling Room", "Elodie's Route House"],
  "oarsmans-bight": ["Morveth's Name Loft", "Lyra's Brine Room", "Kieran's Oar Shed"],
  "crater-watch": ["Toran's Lens Room", "Cassian's Spring Cellar", "Mina's Listening Tent"],
};

function townBuildingName(townId: string, index: number): string {
  const names = TOWN_BUILDING_NAMES[townId];
  if (!names?.[index]) throw new Error(`Town ${townId} needs a name for building ${index}.`);
  return names[index];
}

interface TownInteriorDefinition {
  townId: keyof typeof TOWN_RESIDENTS;
  residentIndex: 0 | 1 | 2;
  name: string;
  /** # wall, . floor, D door, N resident, L lamp, = inlaid floor, ~ sand. */
  layout: string[];
}

/**
 * Every occupied building has its own small, authored room plan. These stay
 * intentionally compact: entering a town gives the player a place to pause,
 * converse, and read the character of the settlement without another trek.
 */
const TOWN_INTERIORS: Record<string, TownInteriorDefinition> = {
  "interior.ilyarael-township.a": {
    townId: "ilyarael-township", residentIndex: 0, name: "Althea's Ledger Room",
    layout: ["###########", "#..=......#", "#.###.L...#", "#...#.....#", "#.N.#.###.#", "#...#.....#", "#...###...#", "#.........#", "#####D#####"],
  },
  "interior.ilyarael-township.b": {
    townId: "ilyarael-township", residentIndex: 1, name: "The Hollow Sister's Cell",
    layout: ["###########", "#....L....#", "#.#######.#", "#.#.....#.#", "#.#.N...#.#", "#.#.....#.#", "#.###.###.#", "#.........#", "#####D#####"],
  },
  "interior.ilyarael-township.c": {
    townId: "ilyarael-township", residentIndex: 2, name: "Barris's Salvage Shop",
    layout: ["###########", "#.........#", "#.###.###.#", "#...#...#.#", "#.N.#.L.#.#", "#...#...#.#", "#.#######.#", "#.........#", "#####D#####"],
  },
  "interior.cinder-haven.a": {
    townId: "cinder-haven", residentIndex: 0, name: "Vance's Kiln Office",
    layout: ["###########", "#...L.....#", "#.#####...#", "#.#...#...#", "#.#.N...=.#", "#.#...#...#", "#.#####...#", "#.........#", "#####D#####"],
  },
  "interior.cinder-haven.b": {
    townId: "cinder-haven", residentIndex: 1, name: "Greta's Cooling Room",
    layout: ["###########", "#....L....#", "#.##...##.#", "#.#.....#.#", "#...N.....#", "#.#.....#.#", "#.##...##.#", "#.........#", "#####D#####"],
  },
  "interior.cinder-haven.c": {
    townId: "cinder-haven", residentIndex: 2, name: "Elodie's Route House",
    layout: ["###########", "#.........#", "#.L.###...#", "#...#.....#", "#.###.N##.#", "#.....#...#", "#...###...#", "#.........#", "#####D#####"],
  },
  "interior.oarsmans-bight.a": {
    townId: "oarsmans-bight", residentIndex: 0, name: "Morveth's Name Loft",
    layout: ["###########", "#...L.....#", "#.~~~~~...#", "#.~...~...#", "#.~.N.~.=.#", "#.~...~...#", "#.~~~~~...#", "#.........#", "#####D#####"],
  },
  "interior.oarsmans-bight.b": {
    townId: "oarsmans-bight", residentIndex: 1, name: "Lyra's Brine Room",
    layout: ["###########", "#....L....#", "#.##...##.#", "#...~.....#", "#.N.~~~...#", "#.....~...#", "#.##...##.#", "#.........#", "#####D#####"],
  },
  "interior.oarsmans-bight.c": {
    townId: "oarsmans-bight", residentIndex: 2, name: "Kieran's Oar Shed",
    layout: ["###########", "#.........#", "#.###.###.#", "#...#.....#", "#.=.#.N.L.#", "#...#.....#", "#.###.###.#", "#.........#", "#####D#####"],
  },
  "interior.crater-watch.a": {
    townId: "crater-watch", residentIndex: 0, name: "Toran's Lens Room",
    layout: ["###########", "#....L....#", "#.###.###.#", "#.#.....#.#", "#.#.N.=.#.#", "#.#.....#.#", "#.###.###.#", "#.........#", "#####D#####"],
  },
  "interior.crater-watch.b": {
    townId: "crater-watch", residentIndex: 1, name: "Cassian's Spring Cellar",
    layout: ["###########", "#.........#", "#.~~~~~...#", "#.~...~...#", "#.~~~.~.N.#", "#.....~...#", "#.#####...#", "#....L....#", "#####D#####"],
  },
  "interior.crater-watch.c": {
    townId: "crater-watch", residentIndex: 2, name: "Mina's Listening Tent",
    layout: ["###########", "#....L....#", "#.=.....=.#", "#...###...#", "#.N.#.#...#", "#...###...#", "#.=.....=.#", "#.........#", "#####D#####"],
  },
};

interface ParsedTownInterior {
  width: number;
  height: number;
  door: Vec;
  npc: Vec;
  lights: Vec[];
  tiles: Uint8Array;
}

function parseTownInterior(id: string, rows: string[]): ParsedTownInterior {
  if (rows.length === 0) throw new Error(`Interior ${id} needs at least one row.`);
  const width = rows[0].length;
  const tiles = new Uint8Array(width * rows.length);
  const doors: Vec[] = [];
  const npcs: Vec[] = [];
  const lights: Vec[] = [];
  for (const [y, row] of rows.entries()) {
    if (row.length !== width) throw new Error(`Interior row ${y} has width ${row.length}, expected ${width} in ${id}`);
    for (let x = 0; x < width; x++) {
      const glyph = row[x];
      if (!"#.DNL=~".includes(glyph)) throw new Error(`Unknown interior glyph "${glyph}" at ${x},${y} in ${id}`);
      tiles[y * width + x] = glyph === "#" ? T.INTERIOR_WALL : glyph === "=" ? T.SPIREFLOOR : glyph === "~" ? T.SAND : glyph === "L" ? T.CRYSTAL : T.INTERIOR_FLOOR;
      if (glyph === "D") doors.push({ x, y });
      if (glyph === "N") npcs.push({ x, y });
      if (glyph === "L") lights.push({ x: px(x), y: px(y) });
    }
  }
  if (doors.length !== 1 || npcs.length !== 1) throw new Error(`Interior ${id} needs exactly one door and resident.`);
  return { width, height: rows.length, door: doors[0], npc: npcs[0], lights, tiles };
}

function townInteriorSpawn(interiorId: string): Vec {
  const definition = TOWN_INTERIORS[interiorId];
  if (!definition) throw new Error(`Unknown town interior: ${interiorId}`);
  const { door } = parseTownInterior(interiorId, definition.layout);
  return { x: px(door.x), y: px(door.y - 1) };
}

function townBuildingExits(towns: TownData[]): RegionExit[] {
  return towns.flatMap((town) => town.buildings.map((building) => ({
    x: building.x,
    y: building.y,
    targetRegion: building.interiorId,
    destination: townInteriorSpawn(building.interiorId),
    label: building.name,
    requiresInteraction: true,
  })));
}

function generateTownInteriorMap(regionId: string): MapData {
  const definition = TOWN_INTERIORS[regionId];
  if (!definition) throw new Error(`Unknown town interior: ${regionId}`);
  const layout = parseTownInterior(regionId, definition.layout);
  const resident = TOWN_RESIDENTS[definition.townId][definition.residentIndex];
  const placement = TOWN_PLACEMENTS[definition.townId];
  const exterior = parseTownLayout(definition.townId, TOWN_LAYOUTS[definition.townId]);
  const suffix = regionId.slice(-1).toUpperCase() as "A" | "B" | "C";
  const exteriorDoor = exterior.buildingDoors.find((door) => door.glyph === suffix);
  if (!exteriorDoor) throw new Error(`No exterior door for ${regionId}`);
  return {
    regionName: definition.name,
    width: layout.width,
    height: layout.height,
    tiles: layout.tiles,
    wardTiles: [],
    spawn: townInteriorSpawn(regionId),
    npcs: [{ ...resident, x: px(layout.npc.x), y: px(layout.npc.y) }],
    npc: { x: -9999, y: -9999 },
    signs: [],
    shards: [],
    enemySpawns: [],
    bossCenter: { x: -9999, y: -9999 },
    exits: [{
      x: layout.door.x,
      y: layout.door.y,
      targetRegion: placement.regionId,
      destination: { x: px(placement.x + exteriorDoor.x), y: px(placement.y + exteriorDoor.y + 1) },
      label: definition.townId.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
      requiresInteraction: true,
    }],
    campfires: [],
    towns: [],
    // Houses are intentionally readable sanctuaries; their lamps still add
    // warmth, but a darkness mask should not hide the room the player entered.
    dark: false,
    resetOnDeath: false,
    lights: layout.lights,
  };
}

export function isInteriorRegion(regionId: string): boolean {
  return regionId.startsWith("fortress.") || regionId.startsWith("interior.");
}

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

/**
 * Builds an authored, imposing exterior fortress facade and paved courtyard.
 * Every fortress has an unmistakable silhouette that rewards the journey.
 */
function buildFortressExterior(
  tiles: Uint8Array,
  gx: number,
  gy: number,
  theme: FortressTheme
) {
  // Paved courtyard leading up to the gate
  for (let dy = -1; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const tx = gx + dx;
      const ty = gy + dy;
      if (!inB(tx, ty)) continue;
      tiles[idx(tx, ty)] =
        theme === "glass" || theme === "observatory"
          ? T.SPIREFLOOR
          : theme === "salt"
          ? T.SAND
          : T.RFLOOR;
    }
  }

  // Gateway facade walls flanking the entrance archway
  for (let dx = -4; dx <= 4; dx++) {
    if (dx === 0) continue; // the gate itself is walkable floor
    const tx = gx + dx;
    if (inB(tx, gy)) {
      tiles[idx(tx, gy)] = theme === "timber" ? T.TREE : theme === "salt" ? T.ROCK : T.RWALL;
    }
  }

  // Gate entrance tile is walkable floor
  if (inB(gx, gy)) {
    tiles[idx(gx, gy)] = theme === "glass" || theme === "observatory" ? T.SPIREFLOOR : T.RFLOOR;
  }
  // Step-out arrival tile in front is clear floor
  if (inB(gx, gy + 1)) {
    tiles[idx(gx, gy + 1)] =
      theme === "glass" || theme === "observatory"
        ? T.SPIREFLOOR
        : theme === "salt"
        ? T.SAND
        : T.RFLOOR;
  }

  // Flanking pillars/towers
  if (inB(gx - 2, gy)) tiles[idx(gx - 2, gy)] = T.RWALL;
  if (inB(gx + 2, gy)) tiles[idx(gx + 2, gy)] = T.RWALL;
  if (inB(gx - 2, gy - 1)) tiles[idx(gx - 2, gy - 1)] = T.RWALL;
  if (inB(gx + 2, gy - 1)) tiles[idx(gx + 2, gy - 1)] = T.RWALL;

  // Distinct themed architectural elements
  switch (theme) {
    case "timber":
      if (inB(gx - 3, gy + 1)) tiles[idx(gx - 3, gy + 1)] = T.BONES;
      if (inB(gx + 3, gy + 1)) tiles[idx(gx + 3, gy + 1)] = T.BONES;
      if (inB(gx - 4, gy + 2)) tiles[idx(gx - 4, gy + 2)] = T.TREE;
      if (inB(gx + 4, gy + 2)) tiles[idx(gx - 4, gy + 2)] = T.TREE;
      break;
    case "glass":
      if (inB(gx - 2, gy + 2)) tiles[idx(gx - 2, gy + 2)] = T.CRYSTAL;
      if (inB(gx + 2, gy + 2)) tiles[idx(gx + 2, gy + 2)] = T.CRYSTAL;
      if (inB(gx - 4, gy + 1)) tiles[idx(gx - 4, gy + 1)] = T.WATER;
      if (inB(gx + 4, gy + 1)) tiles[idx(gx + 4, gy + 1)] = T.WATER;
      break;
    case "vault":
      if (inB(gx - 3, gy + 2)) tiles[idx(gx - 3, gy + 2)] = T.RWALL;
      if (inB(gx + 3, gy + 2)) tiles[idx(gx + 3, gy + 2)] = T.RWALL;
      if (inB(gx - 4, gy + 3)) tiles[idx(gx - 4, gy + 3)] = T.CRYSTAL;
      break;
    case "cinder":
      if (inB(gx - 3, gy + 1)) tiles[idx(gx - 3, gy + 1)] = T.EMBERS;
      if (inB(gx + 3, gy + 1)) tiles[idx(gx + 3, gy + 1)] = T.EMBERS;
      if (inB(gx - 3, gy + 2)) tiles[idx(gx - 3, gy + 2)] = T.ROCK;
      if (inB(gx + 3, gy + 2)) tiles[idx(gx + 3, gy + 2)] = T.ROCK;
      break;
    case "watchpost":
      if (inB(gx - 4, gy + 1)) tiles[idx(gx - 4, gy + 1)] = T.RWALL;
      if (inB(gx + 4, gy + 1)) tiles[idx(gx + 4, gy + 1)] = T.RWALL;
      if (inB(gx - 3, gy + 2)) tiles[idx(gx - 3, gy + 2)] = T.ROCK;
      if (inB(gx + 3, gy + 2)) tiles[idx(gx + 3, gy + 2)] = T.ROCK;
      break;
    case "salt":
      if (inB(gx - 3, gy + 1)) tiles[idx(gx - 3, gy + 1)] = T.GRAVE;
      if (inB(gx + 3, gy + 1)) tiles[idx(gx + 3, gy + 1)] = T.GRAVE;
      if (inB(gx - 4, gy + 2)) tiles[idx(gx - 4, gy + 2)] = T.ROCK;
      if (inB(gx + 4, gy + 2)) tiles[idx(gx + 4, gy + 2)] = T.ROCK;
      break;
    case "beacon":
      if (inB(gx - 2, gy + 1)) tiles[idx(gx - 2, gy + 1)] = T.RWALL;
      if (inB(gx + 2, gy + 1)) tiles[idx(gx + 2, gy + 1)] = T.RWALL;
      if (inB(gx - 4, gy + 1)) tiles[idx(gx - 4, gy + 1)] = T.WATER;
      if (inB(gx + 4, gy + 1)) tiles[idx(gx + 4, gy + 1)] = T.WATER;
      break;
    case "observatory":
      for (let r = 3; r <= 5; r++) {
        for (let a = 0; a < Math.PI; a += 0.3) {
          const rx = Math.round(gx + Math.cos(a) * r);
          const ry = Math.round(gy - Math.sin(a) * r);
          if (inB(rx, ry)) tiles[idx(rx, ry)] = T.ROCK;
        }
      }
      if (inB(gx - 3, gy + 2)) tiles[idx(gx - 3, gy + 2)] = T.CRYSTAL;
      if (inB(gx + 3, gy + 2)) tiles[idx(gx + 3, gy + 2)] = T.CRYSTAL;
      break;
    case "watch":
      if (inB(gx - 3, gy + 1)) tiles[idx(gx - 3, gy + 1)] = T.RWALL;
      if (inB(gx + 3, gy + 1)) tiles[idx(gx + 3, gy + 1)] = T.RWALL;
      if (inB(gx - 2, gy + 3)) tiles[idx(gx - 2, gy + 3)] = T.CRYSTAL;
      if (inB(gx + 2, gy + 3)) tiles[idx(gx + 2, gy + 3)] = T.CRYSTAL;
      break;
  }
}

export function isInsideTownSafeZone(map: MapData, x: number, y: number): boolean {
  for (const town of map.towns) {
    if (Math.hypot(x - town.x, y - town.y) < town.safeRadius) return true;
  }
  return false;
}

export function generateMap(regionId = "overworld"): MapData {
  if (regionId.startsWith("fortress.")) return generateFortressMap(regionId);
  if (regionId.startsWith("interior.")) return generateTownInteriorMap(regionId);
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
    for (let x = 0; x < 42; x++) {
      const i = idx(x, y);
      const dSpawn = Math.hypot(x - 14, y - 42);
      if (dSpawn < 5.5) continue; // keep the starting clearing open
      if (fine[i] > 0.68 && rng() < 0.48) tiles[i] = T.TREE;
    }
  }

  // ----- The Murkwater lake -----
  const lx = 66;
  const ly = 24;
  const lrx = 14;
  const lry = 8;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const d = Math.hypot((x - lx) / lrx, (y - ly) / lry);
      if (d < 1) tiles[idx(x, y)] = T.WATER;
      else if (d < 1.28 && tiles[idx(x, y)] !== T.WATER) tiles[idx(x, y)] = T.SAND;
    }
  }

  // ----- Northern Alpine Crags & Cliffs -----
  for (let y = 6; y <= 20; y++) {
    for (let x = 80; x <= 115; x++) {
      if (inB(x, y) && fine[idx(x, y)] > 0.72 && rng() < 0.4) tiles[idx(x, y)] = T.ROCK;
    }
  }

  // ----- Mountain barrier (full height, with a pass) -----
  for (let y = 0; y < MAP_H; y++) {
    if (y >= 20 && y <= 28) continue; // the grand mountain pass
    for (let x = 84; x <= 87; x++) tiles[idx(x, y)] = T.ROCK;
  }
  for (let i = 0; i < 64; i++) {
    const x = 82 + Math.floor(rng() * 8);
    const y = Math.floor(rng() * MAP_H);
    if (y >= 19 && y <= 29) continue;
    if (inB(x, y) && tiles[idx(x, y)] !== T.WATER) tiles[idx(x, y)] = T.ROCK;
  }

  // ----- Ruins of Ilyarael (the fallen elven citadel) -----
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
  hall(46, 64, 66, 82);
  tiles[idx(56, 64)] = T.RFLOOR; // north entrance
  tiles[idx(56, 65)] = T.RFLOOR;
  tiles[idx(56, 74)] = T.RFLOOR; // Watcher's dais

  // ----- The Moonfall Reach and the True Glass Spire arena -----
  const trueSpireX = 140;
  const trueSpireY = 26;
  for (let y = 14; y <= 38; y++) {
    for (let x = 126; x <= 154; x++) {
      const d = Math.hypot(x - trueSpireX, y - trueSpireY);
      if (d <= 8) tiles[idx(x, y)] = T.SPIREFLOOR;
      else if (d <= 11) tiles[idx(x, y)] = T.ROCK;
    }
  }
  // Gateway into the True Spire arena
  for (let x = 124; x <= 128; x++) tiles[idx(x, 26)] = T.SPIREFLOOR;
  const wardTiles = [idx(126, 25), idx(126, 26), idx(126, 27)];
  for (const wi of wardTiles) tiles[wi] = T.SPIREFLOOR;
  const wardSet = new Set(wardTiles);

  // ----- Ashen Expanse (south) -----
  for (let y = 80; y < MAP_H; y++) {
    for (let x = 24; x < 134; x++) {
      const i = idx(x, y);
      if (patches[i] < 0.5) tiles[i] = T.DGRASS;
      if (fine[i] > 0.82 && rng() < 0.35) tiles[i] = T.ROCK;
    }
  }
  // Moonlit water inlet
  for (let y = 96; y <= 110; y++) {
    for (let x = 130; x <= 158; x++) {
      if (Math.hypot((x - 144) / 14, (y - 103) / 7) < 1) tiles[idx(x, y)] = T.WATER;
    }
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

  // Road network across the Old Lands
  carve(14, 42, 56, 42); // spawn east to central north-south junction
  carve(24, 42, 24, 18); // north track to The Weeping Archive
  carve(56, 42, 56, 26); // north toward the lake bridge
  carve(56, 26, 84, 26); // east across Murkwater Lake bridge and through the mountain pass
  carve(84, 26, 84, 14); // alpine pass north toward Glass Reliquary
  carve(84, 14, 96, 14);
  carve(56, 42, 56, 64); // branch south into Ruins of Ilyarael
  carve(56, 76, 78, 76); // branch east to Ilyarael's Sealed Vault
  carve(56, 82, 56, 88); // exit south into Ashen Expanse
  carve(56, 88, 120, 88); // southern ash highway to Moonfall Crossing
  carve(96, 88, 96, 110); // south road to Moonlit Coast
  carve(120, 88, 156, 90); // east road to Cinderwild
  carve(84, 26, 126, 26); // mountain pass east to Moonfall Reach & True Spire
  carve(120, 88, 120, 38); // Moonfall Crossing north to Spire approach
  carve(120, 38, 126, 26);

  // ----- Ilyarael Township: a safe settlement on the southern road -----
  const towns: TownData[] = [
    stampTown(tiles, "ilyarael-township", TOWN_PLACEMENTS["ilyarael-township"].x, TOWN_PLACEMENTS["ilyarael-township"].y, TOWN_RESIDENTS["ilyarael-township"]),
  ];

  // Spur road from the southern ash highway to the township door
  carve(56, 88, 56, 98);
  carve(56, 98, 68, 98);
  // ----- Authored Exterior Fortress Sites -----
  buildFortressExterior(tiles, 24, 18, "timber");
  buildFortressExterior(tiles, 96, 14, "glass");
  buildFortressExterior(tiles, 78, 76, "vault");

  // ----- Decoration -----
  const isGrass = (t: number) => t === T.GRASS || t === T.DGRASS;
  const crystalNear = (x: number, y: number) => {
    if (!inB(x, y) || !isGrass(tiles[idx(x, y)])) return;
    tiles[idx(x, y)] = T.CRYSTAL;
  };
  for (let i = 0; i < 36; i++) {
    crystalNear(46 + Math.floor(rng() * 26), 60 + Math.floor(rng() * 20));
    crystalNear(90 + Math.floor(rng() * 26), 10 + Math.floor(rng() * 20));
  }
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(rng() * MAP_W);
    const y = Math.floor(rng() * MAP_H);
    if (isGrass(tiles[idx(x, y)]) && fine[idx(x, y)] > 0.46) tiles[idx(x, y)] = T.TALLGRASS;
  }
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(rng() * MAP_W);
    const y = Math.floor(rng() * MAP_H);
    if (isGrass(tiles[idx(x, y)]) && rng() < 0.5) tiles[idx(x, y)] = T.FLOWER;
  }
  for (let i = 0; i < 40; i++) {
    const x = 4 + Math.floor(rng() * 32);
    const y = 4 + Math.floor(rng() * 36);
    if (isGrass(tiles[idx(x, y)])) tiles[idx(x, y)] = rng() < 0.5 ? T.GRAVE : T.BONES;
  }
  for (let i = 0; i < 48; i++) {
    const x = Math.floor(rng() * MAP_W);
    const y = Math.floor(rng() * MAP_H);
    if (isGrass(tiles[idx(x, y)]) && x > 44 && x < 80) tiles[idx(x, y)] = T.ROCK;
  }
  // Clear starting glade around spawn
  for (let y = 39; y <= 45; y++) {
    for (let x = 11; x <= 17; x++) {
      if (tiles[idx(x, y)] === T.TREE || tiles[idx(x, y)] === T.ROCK) tiles[idx(x, y)] = T.GRASS;
    }
  }

  // ----- Entities / points of interest -----
  const exits: RegionExit[] = [
    { x: 156, y: 90, targetRegion: "cinderwild", destination: { x: px(10), y: px(58) }, label: "Cinderwild" },
    { x: 96, y: 110, targetRegion: "moonlit-coast", destination: { x: px(80), y: px(8) }, label: "Moonlit Coast" },
    fortressExit(24, 18, "fortress.old-lands-archive", "The Weeping Archive"),
    fortressExit(96, 14, "fortress.old-lands-reliquary", "The Glass Reliquary"),
    fortressExit(78, 76, "fortress.old-lands-vault", "Ilyarael's Sealed Vault"),
  ];

  const signs: SignData[] = [
    {
      x: 17,
      y: 43,
      title: "A Traveller's Primer",
      text: "MOVE  WASD / Arrows · ATTACK  J / Space · DASH  Shift · SPEAK / READ  E · JOURNAL  L · PAUSE  Esc. The Watcher keeps the hall in Ilyarael: this road east to the junction, then south past the wayfire into the ruin. Write down what you find. Nobody else is going to.",
    },
    {
      x: 56,
      y: 68,
      title: "Inscription at Ilyarael",
      text: "Here stood Ilyarael. Orithel keeps the hall through this northern doorway. A scout marked three sealed doors before she stopped reporting: north along the western forest track; north of the mountain pass beyond the lake; and east of this approach, below the hall's broken seal.",
    },
    {
      x: 62,
      y: 76,
      title: "The Courier's Orders",
      fact: "courier-orders",
      text: "Deliver the vessel to the collector at the broken shrine northeast of the Cinderwild's central circle. Do not open it. Do not listen to it. Beneath the seal, in a hand that tore the paper: ‘It has a child's voice. I have read this four times looking for the part where this is something other than what it fucking is. It isn't there. It was never going to be there.’",
    },
    {
      x: 78,
      y: 24,
      title: "The Spire Warning",
      text: "Beyond the black ridge stands a glass tower. The old moon-road crosses the lake and keeps east. Those who followed it came back describing a sleeping thing. The ones who stayed and listened longer came back describing a crowd.",
    },
    {
      x: 90,
      y: 28,
      title: "A Pilgrim's Correction",
      text: "The first Spire is empty. Its keeper went east past the old ward. The pale-stone road is surest; the southern ash road has fewer eyes on it, if that matters to you. It mattered to me.",
    },
    {
      x: 102,
      y: 88,
      title: "Charred Surveyor's Page",
      text: "No fragments remain in the ash country — collected long ago, the ledger says, though it does not say by whom or on whose authority. At this junction the south road reaches Moonlit Coast; east past Moonfall Crossing lies the Cinderwild. Each frontier holds two. Both roads run on to the Starfall Moors, where the last pair went.",
    },
    {
      x: 120,
      y: 88,
      title: "Moonfall Crossing",
      text: "East into the Cinderwild. North back toward the Spire. Nine fragments answer the ward: three in the Old Lands, two in each frontier — Cinderwild, Moonlit Coast, Starfall Moors. Nine is not a natural number for a ward. Somebody asked for nine.",
    },
    {
      x: 122,
      y: 42,
      title: "Offering Ledger",
      text: "Before entering Moonfall Reach, travellers left offerings at the fork north of the ash road. The last party took the eastern path. The ledger records their offering and their names, and then a second entry striking the names out, in a different hand, dated the same day.",
    },
    {
      x: 125,
      y: 26,
      title: "The Last Ward",
      text: "Nine Anima Shards shall quiet the dreamer. No fewer. The ward does not point the way. It only remembers what was taken, which is the one thing everybody involved would rather it did not do.",
    },
    {
      x: 24,
      y: 18,
      title: "The Weeping Archive",
      text: "The forest track ends at a door of black timber. The records inside have been sealed against weather, fire, and the people they were written about.",
    },
    {
      x: 96,
      y: 14,
      title: "The Glass Reliquary",
      text: "The first Spire is empty above ground. Its lower door reflects you badly, as if someone else has been asked to stand where you are.",
    },
    {
      x: 78,
      y: 76,
      title: "Ilyarael's Sealed Vault",
      text: "The hall has another door below its east approach. The old elven seal is broken from the inside.",
    },
    {
      x: 156,
      y: 90,
      title: "East Road Marker",
      text: "The Cinderwild lies east: ash storms, broken shrines, no easy return. A tall stone circle at its heart, if the scouts were being honest.",
    },
    {
      x: 96,
      y: 110,
      title: "South Road Marker",
      text: "Moonlit Coast lies south. Follow the salt wind to lands the old maps forgot, or were made to forget. A pale beacon burns where its roads meet.",
    },
  ];

  // Settlement signs are authored with the layout so a town always advertises itself.
  for (const town of towns) if (town.sign) signs.push(town.sign);

  const shards: Vec[] = [];

  // 18 enemies strategically distributed across the expanded Old Lands
  const enemySpawns: EnemySpawn[] = [
    // Weeping Forest patrols & Archive guards
    { x: 20, y: 34, type: "wraith" },
    { x: 30, y: 50, type: "wraith" },
    { x: 16, y: 26, type: "wraith" },
    { x: 24, y: 23, type: "sentinel" }, // The Weeping Archive perimeter guard
    // Murkwater Lake shores
    { x: 48, y: 24, type: "sentinel" },
    { x: 70, y: 36, type: "adept" },
    // Mountain Pass guards
    { x: 84, y: 22, type: "sentinel" },
    { x: 86, y: 28, type: "sentinel" },
    // Alpine crags & Glass Reliquary guard
    { x: 94, y: 18, type: "sentinel" }, // The Glass Reliquary perimeter guard
    // Ruins of Ilyarael perimeter & Vault guard
    { x: 48, y: 78, type: "wraith" },
    { x: 66, y: 68, type: "adept" },
    { x: 76, y: 80, type: "sentinel" }, // Ilyarael's Sealed Vault perimeter guard
    // Ashen Expanse patrols
    { x: 40, y: 94, type: "wraith" },
    { x: 44, y: 104, type: "wraith" },
    { x: 92, y: 96, type: "sentinel" },
    { x: 114, y: 96, type: "adept" },
    // Moonfall Crossing & Spire approaches
    { x: 124, y: 86, type: "sentinel" },
    { x: 128, y: 34, type: "adept" },
  ];

  return {
    regionName: "The Old Lands",
    width: MAP_W,
    height: MAP_H,
    tiles,
    wardTiles,
    spawn: { x: px(14), y: px(42) },
    npcs: towns.flatMap((town) => town.npcs ?? []),
    npc: { x: px(56), y: px(74) },
    signs,
    shards,
    enemySpawns,
    bossCenter: { x: px(trueSpireX), y: px(trueSpireY) },
    exits: [...exits, ...townBuildingExits(towns)],
    campfires: [{ x: px(56), y: px(60), name: "Ilyarael's Last Ember", relic: "emberheart" }],
    dark: false,
    resetOnDeath: false,
    lights: [],
    towns,
  };
}

/** Three large, seeded frontiers make the journey a world rather than one field. */
function generateFrontierMap(regionId: string): MapData {
  const configs: Record<
    string,
    {
      name: string;
      seed: number;
      water: boolean;
      exits: RegionExit[];
      siteTiles: [number, number, FortressTheme][];
      relic: CampfireData["relic"];
      intermediateWaypoints: [number, number, number, number][];
      townConfig?: {
        id: string;
        x: number;
        y: number;
        npcs: Omit<NpcData, "x" | "y">[];
        spurRoad: [number, number, number, number][];
      };
    }
  > = {
    cinderwild: {
      name: "The Cinderwild",
      seed: 0xc1d3a,
      water: false,
      exits: [
        { x: 6, y: 58, targetRegion: "overworld", destination: { x: px(152), y: px(90) }, label: "The Old Lands" },
        { x: 154, y: 104, targetRegion: "starfall-moors", destination: { x: px(14), y: px(14) }, label: "Starfall Moors" },
        fortressExit(132, 22, "fortress.cinderwild-shrine", "The Broken Shrine"),
        fortressExit(142, 78, "fortress.cinderwild-watchpost", "The Ruined Watchpost"),
      ],
      siteTiles: [
        [132, 22, "cinder"],
        [142, 78, "watchpost"],
      ],
      relic: "ashstep",
      intermediateWaypoints: [
        [6, 58, 42, 56],
        [42, 56, 80, 56],
        [80, 56, 108, 38],
        [108, 38, 132, 22],
        [80, 56, 114, 68],
        [114, 68, 142, 78],
        [114, 68, 154, 104],
      ],
      townConfig: {
        id: "cinder-haven",
        x: TOWN_PLACEMENTS["cinder-haven"].x,
        y: TOWN_PLACEMENTS["cinder-haven"].y,
        npcs: TOWN_RESIDENTS["cinder-haven"],
        spurRoad: [
          [80, 56, 50, 56],
          [50, 56, 50, 75],
        ],
      },
    },
    "moonlit-coast": {
      name: "Moonlit Coast",
      seed: 0xbadc0de,
      water: true,
      exits: [
        { x: 80, y: 5, targetRegion: "overworld", destination: { x: px(96), y: px(106) }, label: "The Old Lands" },
        { x: 154, y: 76, targetRegion: "starfall-moors", destination: { x: px(14), y: px(96) }, label: "Starfall Moors" },
        fortressExit(28, 88, "fortress.moonlit-salt-graves", "The Salt Graves"),
        fortressExit(136, 20, "fortress.moonlit-beacon", "The Keeper's Beacon"),
      ],
      siteTiles: [
        [28, 88, "salt"],
        [136, 20, "beacon"],
      ],
      relic: "tidewell",
      intermediateWaypoints: [
        [80, 5, 80, 56],
        [80, 56, 52, 72],
        [52, 72, 28, 88],
        [80, 56, 110, 36],
        [110, 36, 136, 20],
        [80, 56, 118, 66],
        [118, 66, 154, 76],
      ],
      townConfig: {
        id: "oarsmans-bight",
        x: TOWN_PLACEMENTS["oarsmans-bight"].x,
        y: TOWN_PLACEMENTS["oarsmans-bight"].y,
        npcs: TOWN_RESIDENTS["oarsmans-bight"],
        spurRoad: [
          [80, 56, 86, 56],
          [86, 56, 86, 77],
        ],
      },
    },
    "starfall-moors": {
      name: "The Starfall Moors",
      seed: 0x57a2fa11,
      water: false,
      exits: [
        { x: 10, y: 12, targetRegion: "cinderwild", destination: { x: px(150), y: px(102) }, label: "The Cinderwild" },
        { x: 10, y: 98, targetRegion: "moonlit-coast", destination: { x: px(150), y: px(76) }, label: "Moonlit Coast" },
        fortressExit(36, 24, "fortress.starfall-observatory", "The Fallen Observatory"),
        fortressExit(142, 62, "fortress.starfall-watch", "The Astronomer's Watch"),
      ],
      siteTiles: [
        [36, 24, "observatory"],
        [142, 62, "watch"],
      ],
      relic: "starblade",
      intermediateWaypoints: [
        [10, 12, 44, 34],
        [44, 34, 80, 56],
        [10, 98, 44, 78],
        [44, 78, 80, 56],
        [80, 56, 56, 38],
        [56, 38, 36, 24],
        [80, 56, 112, 58],
        [112, 58, 142, 62],
      ],
      townConfig: {
        id: "crater-watch",
        x: TOWN_PLACEMENTS["crater-watch"].x,
        y: TOWN_PLACEMENTS["crater-watch"].y,
        npcs: TOWN_RESIDENTS["crater-watch"],
        spurRoad: [
          [80, 56, 74, 56],
          [74, 56, 74, 77],
        ],
      },
    },
  };

  const config = configs[regionId];
  if (!config) throw new Error(`Unknown region: ${regionId}`);
  const rng = mulberry32(config.seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const noise = smoothNoise(rng, 7);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const n = noise[idx(x, y)];
      tiles[idx(x, y)] = n < 0.38 ? T.DGRASS : T.GRASS;
      if (n > 0.82 && rng() < 0.25) tiles[idx(x, y)] = config.water ? T.TALLGRASS : T.ROCK;
      if (n < 0.14 && rng() < 0.35) tiles[idx(x, y)] = config.water ? T.SAND : T.TREE;
    }
  }

  // Broad expedition roads leave room to observe, disengage, and choose fights.
  const road = (x: number, y: number) => {
    if (inB(x, y)) tiles[idx(x, y)] = T.PATH;
  };
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      for (let w = -2; w <= 2; w++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / steps);
        const y = Math.round(y0 + ((y1 - y0) * i) / steps);
        road(
          x + (Math.abs(x1 - x0) > Math.abs(y1 - y0) ? 0 : w),
          y + (Math.abs(x1 - x0) > Math.abs(y1 - y0) ? w : 0)
        );
      }
    }
  };

  // Carve the winding regional highways
  for (const [x0, y0, x1, y1] of config.intermediateWaypoints) {
    line(x0, y0, x1, y1);
  }

  const hub: [number, number] = [80, 56];

  // Landmark circle gives each map a discoverable centre and a combat clearing.
  for (let y = hub[1] - 9; y <= hub[1] + 9; y++) {
    for (let x = hub[0] - 10; x <= hub[0] + 10; x++) {
      const d = Math.hypot(x - hub[0], y - hub[1]);
      if (d < 7) tiles[idx(x, y)] = T.SPIREFLOOR;
      else if (d < 9 && tiles[idx(x, y)] !== T.PATH) tiles[idx(x, y)] = T.ROCK;
    }
  }

  // Clearings around region border exits
  for (const exit of config.exits) {
    for (let y = exit.y - 2; y <= exit.y + 2; y++) {
      for (let x = exit.x - 2; x <= exit.x + 2; x++) {
        road(x, y);
      }
    }
  }

  // Distinct regional environmental geography
  if (regionId === "cinderwild") {
    // Scorched Ravine hazards: rocks and embers flanking the northeast route
    for (let y = 16; y <= 36; y++) {
      for (let x = 98; x <= 136; x++) {
        const i = idx(x, y);
        if (tiles[i] === T.GRASS || tiles[i] === T.DGRASS) {
          const r = rng();
          if (r < 0.22) tiles[i] = T.EMBERS;
          else if (r < 0.38) tiles[i] = T.ROCK;
        }
      }
    }
  } else if (regionId === "moonlit-coast") {
    // Coastal ocean along south and east margins
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const isOcean =
          y > 98 || (x > 146 && y > 14) || (x < 36 && y > 82 && Math.hypot(x - 22, y - 96) < 18);
        if (
          isOcean &&
          tiles[idx(x, y)] !== T.PATH &&
          tiles[idx(x, y)] !== T.RFLOOR &&
          tiles[idx(x, y)] !== T.RWALL
        ) {
          tiles[idx(x, y)] = T.WATER;
        } else if (isOcean && tiles[idx(x, y)] === T.PATH) {
          tiles[idx(x, y)] = T.BRIDGE;
        }
      }
    }
  } else if (regionId === "starfall-moors") {
    // Celestial impact craters across the moors
    const craters = [
      { cx: 36, cy: 24, r: 8 },
      { cx: 58, cy: 82, r: 7 },
      { cx: 120, cy: 32, r: 6 },
      { cx: 104, cy: 86, r: 7 },
    ];
    for (const { cx, cy, r } of craters) {
      for (let y = cy - r - 2; y <= cy + r + 2; y++) {
        for (let x = cx - r - 2; x <= cx + r + 2; x++) {
          if (!inB(x, y)) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (
            d >= r - 1.2 &&
            d <= r + 0.8 &&
            tiles[idx(x, y)] !== T.PATH &&
            tiles[idx(x, y)] !== T.RFLOOR
          ) {
            tiles[idx(x, y)] = T.ROCK;
          } else if (
            d < r - 1.2 &&
            tiles[idx(x, y)] !== T.PATH &&
            tiles[idx(x, y)] !== T.RFLOOR
          ) {
            tiles[idx(x, y)] = rng() < 0.18 ? T.CRYSTAL : T.SPIREFLOOR;
          }
        }
      }
    }
  }

  // Authored, imposing fortress exterior sites
  for (const [x, y, theme] of config.siteTiles) {
    buildFortressExterior(tiles, x, y, theme);
  }

  const signs: SignData[] = config.exits.map((exit) => ({
    x: exit.x,
    y: exit.y,
    title: "Road of Wayfarers",
    text: `The road leads toward ${exit.label}. Old wheel-ruts, mostly. They run deeper going east than coming back, which tells you what the traffic was and which direction it was carrying.`,
  }));

  const surveys: Record<string, string> = {
    cinderwild:
      "This is the Cinder Circle. The northeast track ends at a broken shrine — a fragment there, and a vessel that was never delivered. The southeast track ends at a ruined watchpost, where a warden still holds a second fragment and has forgotten why it is holding anything. The long road southeast reaches the Starfall Moors.",
    "moonlit-coast":
      "At this pale circle: southwest to the salt graves and a fragment; northeast to the keeper's beacon, where a warden watches the second. The graves are the older road and much the better lit, which is not an accident. The eastern road reaches the Starfall Moors.",
    "starfall-moors":
      "The fallen observatory lies northwest of this wayfire, inside the stone ring; a fragment sits among its records. The road east, sloping slightly south, ends at the astronomer's guardian and the last fragment. The northwest road returns to the Cinderwild, the southwest to Moonlit Coast.",
  };
  signs.push({ x: 80, y: 60, title: `${config.name} Survey`, text: surveys[regionId] });

  const records: Record<string, SignData[]> = {
    cinderwild: [
      {
        x: 132,
        y: 22,
        title: "The Broken Shrine",
        fact: "courier-memory",
        text: "A courier's shell, curled around a vessel the size of a fist. She got this far and could not finish, so she spent herself keeping it warm instead — nine hundred years of her, for this. The thing inside is still awake. It has been awake the entire time. It asks, very politely, whether it is going to be allowed to stop. I copy every word into my journal because I do not trust myself to carry it accurately.",
      },
      {
        x: 142,
        y: 78,
        title: "The Ruined Watchpost",
        text: "The southern watch fell defending a fragment, and the warden still walks its circuit around an empty post. It does not know the post is empty. Beyond these fields the southeastern road descends into the Starfall Moors.",
      },
    ],
    "moonlit-coast": [
      {
        x: 28,
        y: 88,
        title: "The Salt Graves",
        fact: "salt-graves",
        text: "No bodies. Only names, scraped down to the stone. The evacuation ledger says the last boat left half empty, and every passenger who did not board carries the same mark in the margin — the intake mark, though the ledger does not call it that. RECONCILED — 41. TRANSFERRED TO COLLECTION — 39. And underneath, in the same clerk's unhurried hand, a note that the remainder, being already struck from the rolls, were not counted out, and that whatever the collectors did with them on the road was not a matter the harbour was obliged to record, a person who does not exist being incapable of complaint. Another account survives at the beacon northeast of the pale circle.",
      },
      {
        x: 136,
        y: 20,
        title: "The Keeper's Beacon",
        fact: "salt-beacon",
        text: "‘I chose. Someone had to choose and I was the one standing there. Forty went on that boat who would not have gone otherwise. I know exactly what that cost and I have never once pretended the arithmetic was clean.’ He is reasonable for eleven pages, and signed every one of them. By the ninth I had started nodding along, and that frightened me worse than the graves did. Orithel would know what to do with this.",
      },
    ],
    "starfall-moors": [
      {
        x: 36,
        y: 24,
        title: "The Fallen Observatory",
        fact: "dawn-record",
        text: "‘One dawn, forever’ is what the plaque says, and what the funding said. The working notes say something else. The lens was an intake prototype and he tested it on himself, deliberately, to demonstrate the process was survivable at scale. He wrote down the moment he understood that it was not. He kept writing for a considerable time after. His guardian waits at the end of the eastern track, just south of east from the wayfire.",
      },
      {
        x: 142,
        y: 62,
        title: "The Astronomer's Watch",
        text: "The guardian's casing carries the observatory seal, stamped into the metal the way equipment is stamped. Something is burning inside it and has not been permitted to stop burning. It will not leave the road while the shell holds.",
      },
    ],
  };
  signs.push(...records[regionId]);

  const towns: TownData[] = [];
  if (config.townConfig) {
    for (const [x0, y0, x1, y1] of config.townConfig.spurRoad) {
      line(x0, y0, x1, y1);
    }
    const town = stampTown(
      tiles,
      config.townConfig.id,
      config.townConfig.x,
      config.townConfig.y,
      config.townConfig.npcs,
    );
    towns.push(town);
    if (town.sign) signs.push(town.sign);
  }

  // Exactly 10 enemies: 2 fortress approach sentinels + 8 wilderness patrols
  const enemySpawns: EnemySpawn[] = [
    { x: config.siteTiles[0][0] - 2, y: config.siteTiles[0][1] + 4, type: "sentinel" },
    { x: config.siteTiles[1][0] - 2, y: config.siteTiles[1][1] + 4, type: "sentinel" },
  ];

  const openGround = (tile: number) =>
    tile === T.GRASS || tile === T.DGRASS || tile === T.TALLGRASS || tile === T.SAND;
  let attempts = 0;
  while (enemySpawns.length < 10 && attempts++ < 600) {
    const x = 12 + Math.floor(rng() * (MAP_W - 24));
    const y = 10 + Math.floor(rng() * (MAP_H - 20));
    if (!openGround(tiles[idx(x, y)])) continue;
    if (Math.hypot(x - hub[0], y - hub[1]) < 16) continue;
    if (config.siteTiles.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 10)) continue;
    if (towns.some((t) => Math.hypot(x * TILE + TILE / 2 - t.x, y * TILE + TILE / 2 - t.y) < t.safeRadius + 32)) continue;
    if (enemySpawns.some((spawn) => Math.hypot(x - spawn.x, y - spawn.y) < 18)) continue;
    const i = enemySpawns.length;
    enemySpawns.push({ x, y, type: i % 4 === 0 ? "adept" : i % 3 === 0 ? "sentinel" : "wraith" });
  }

  return {
    regionName: config.name,
    width: MAP_W,
    height: MAP_H,
    tiles,
    wardTiles: [],
    spawn: { x: px(80), y: px(56) },
    npcs: towns.flatMap((town) => town.npcs ?? []),
    npc: { x: -9999, y: -9999 },
    signs,
    shards: [],
    enemySpawns,
    bossCenter: { x: px(80), y: px(56) },
    exits: [...config.exits, ...townBuildingExits(towns)],
    campfires: [{ x: px(80), y: px(56), name: `${config.name} Wayfire`, relic: config.relic }],
    dark: false,
    resetOnDeath: false,
    lights: [],
    towns,
  };
}

function generateFortressMap(regionId: string): MapData {
  const fortressId = regionId as FortressId;
  const config = FORTRESS_REGIONS[fortressId];
  const rows = FORTRESS_LAYOUTS[fortressId];
  if (!config || !rows) throw new Error(`Unknown fortress: ${regionId}`);
  const layout = parseFortressLayout(rows);
  const enemySpawns: EnemySpawn[] = layout.enemies.map(({ x, y }) => ({ x, y, type: "wraith" as const }));
  if (layout.warden) enemySpawns.push({ x: layout.warden.x, y: layout.warden.y, type: "sentinel", elite: true });

  return {
    regionName: config.name,
    width: layout.width,
    height: layout.height,
    tiles: layout.tiles,
    wardTiles: [],
    spawn: { x: px(layout.door.x), y: px(layout.door.y + 1) },
    npcs: [],
    npc: { x: -9999, y: -9999 },
    signs: [],
    shards: [{ x: px(layout.shard.x), y: px(layout.shard.y) }],
    enemySpawns,
    bossCenter: { x: px(layout.shard.x), y: px(layout.shard.y) },
    exits: [
      {
        x: layout.door.x,
        y: layout.door.y,
        targetRegion: config.returnTo.region,
        destination: config.returnTo.destination,
        label: config.returnTo.label,
      },
    ],
    campfires: [],
    dark: true,
    resetOnDeath: true,
    lights: layout.braziers.map(({ x, y }) => ({ x: px(x), y: px(y) })),
    towns: [],
  };
}
