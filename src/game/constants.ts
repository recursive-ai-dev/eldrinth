export const TILE = 32;
export const MAP_W = 70;
export const MAP_H = 50;

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
} as const;

export type TileType = (typeof T)[keyof typeof T];

// Tiles that always block movement
export const SOLID_TILES = new Set<number>([
  T.WATER,
  T.TREE,
  T.ROCK,
  T.RWALL,
  T.CRYSTAL,
]);
