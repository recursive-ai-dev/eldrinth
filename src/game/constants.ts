export const TILE = 32;
// The original prototype's 70 x 50 map was crossed in a few minutes.  The
// wider frontier gives each landmark room to breathe and makes a full shard
// run feel like a proper expedition.
export const MAP_W = 100;
export const MAP_H = 72;

// Tile type ids
export const T = {
  GRASS: 0,
  DGRASS: 1,
  PATH: 2,
  WATER: 3,
  TREE: 4,
  ROCK: 5,
  RFLOOR: 6,
  RWALL: 7,
  CRYSTAL: 8,
  FLOWER: 9,
  BRIDGE: 10,
  GRAVE: 11,
  BONES: 12,
  TALLGRASS: 13,
  SPIREFLOOR: 14,
  SAND: 15,
  LEDGE: 16,
  SLOPE_UP_LEFT: 17,
  SLOPE_UP_RIGHT: 18,
  TRIGGER: 19,
  EMBERS: 20,
} as const;

export type TileType = (typeof T)[keyof typeof T];

/**
 * Authoritative physical behaviour for a tile. Rendering and gameplay may
 * introduce tiles freely, but movement always asks this catalogue rather than
 * consulting a separately generated collision bitmap.
 */
export type TileShape = "none" | "solid" | "oneWayUp" | "slopeUpLeft" | "slopeUpRight" | "trigger";

export interface TileDefinition {
  shape: TileShape;
  /** Optional named gameplay event; triggers never block by themselves. */
  trigger?: string;
  /** Drawn after actors so they can pass behind a tall asset. */
  tall?: boolean;
}

const BLOCKING: TileDefinition = { shape: "solid" };
const PASSABLE: TileDefinition = { shape: "none" };

export const TILE_DEFINITIONS: Readonly<Record<number, TileDefinition>> = {
  [T.GRASS]: PASSABLE,
  [T.DGRASS]: PASSABLE,
  [T.PATH]: PASSABLE,
  [T.WATER]: BLOCKING,
  [T.TREE]: { ...BLOCKING, tall: true },
  [T.ROCK]: { ...BLOCKING, tall: true },
  [T.RFLOOR]: PASSABLE,
  [T.RWALL]: { ...BLOCKING, tall: true },
  [T.CRYSTAL]: { ...BLOCKING, tall: true },
  [T.FLOWER]: PASSABLE,
  [T.BRIDGE]: PASSABLE,
  [T.GRAVE]: { ...BLOCKING, tall: true },
  [T.BONES]: PASSABLE,
  [T.TALLGRASS]: PASSABLE,
  [T.SPIREFLOOR]: PASSABLE,
  [T.SAND]: PASSABLE,
  [T.LEDGE]: { shape: "oneWayUp" },
  [T.SLOPE_UP_LEFT]: { shape: "slopeUpLeft" },
  [T.SLOPE_UP_RIGHT]: { shape: "slopeUpRight" },
  [T.TRIGGER]: { shape: "trigger", trigger: "tile" },
};

export function tileDefinition(tile: number): TileDefinition {
  return TILE_DEFINITIONS[tile] ?? PASSABLE;
}
