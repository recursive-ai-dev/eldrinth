export interface FrameRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface ActionMeta {
  row: number;
  frames: number;
  fps?: number;
}

export interface SpriteManifest {
  kind: "human" | "creature" | "item" | "tile" | "prop" | "settlement" | "structure";
  cellW: number;
  cellH: number;
  columns?: number;
  directions?: string[];
  actions?: Record<string, ActionMeta>;
  static: boolean;
  autotile?: boolean;
  autotileMode?: "blob47";
  regionPalette?: string;
  masks?: number;
  variants?: number;
  frames?: number;
}

export interface SpriteAtlas {
  ready: boolean;
  image: HTMLImageElement | null;
  manifest?: SpriteManifest | null;
  getFrame(direction: string, action: string, frame: number): FrameRect | null;
  getStaticFrame(maskOrIndex?: number): FrameRect | null;
}

interface LoadedAtlas extends SpriteAtlas {
  loaded: Promise<void>;
}

/** 8-neighbor Blob Wang bits: N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128. */
export const WANG_N = 1;
export const WANG_E = 2;
export const WANG_S = 4;
export const WANG_W = 8;
export const WANG_NE = 16;
export const WANG_SE = 32;
export const WANG_SW = 64;
export const WANG_NW = 128;

/**
 * Normalize an 8-bit neighbor mask to one of the 47 canonical Blob Wang masks.
 * Diagonal bits are retained only when both adjacent cardinal neighbors exist.
 */
export function canonicalBlobMask(mask: number): number {
  let m = mask & (WANG_N | WANG_E | WANG_S | WANG_W);
  if ((mask & WANG_N) && (mask & WANG_E) && (mask & WANG_NE)) m |= WANG_NE;
  if ((mask & WANG_E) && (mask & WANG_S) && (mask & WANG_SE)) m |= WANG_SE;
  if ((mask & WANG_S) && (mask & WANG_W) && (mask & WANG_SW)) m |= WANG_SW;
  if ((mask & WANG_W) && (mask & WANG_N) && (mask & WANG_NW)) m |= WANG_NW;
  return m;
}

export const BLOB_47_MASKS: readonly number[] = (() => {
  const out: number[] = [];
  for (let m = 0; m < 256; m++) {
    if (canonicalBlobMask(m) === m) out.push(m);
  }
  return out;
})();

const BLOB_INDEX_LOOKUP = (() => {
  const table = new Uint8Array(256);
  const indexByCanonical = new Map<number, number>();
  BLOB_47_MASKS.forEach((m, idx) => indexByCanonical.set(m, idx));
  for (let raw = 0; raw < 256; raw++) {
    table[raw] = indexByCanonical.get(canonicalBlobMask(raw)) ?? 0;
  }
  return table;
})();

/** Map any raw 8-bit neighbor mask (0..255) to its canonical 0..46 Blob atlas index in O(1). */
export function blobMaskIndex(mask: number): number {
  return BLOB_INDEX_LOOKUP[mask & 0xff] ?? 0;
}

const ACTION_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  idle: ["idle", "walk"],
  walk: ["walk", "idle"],
  attack: ["attack", "walk"],
  cast: ["cast", "attack", "walk"],
  hurt: ["hurt", "walk"],
  death: ["death", "hurt", "walk"],
};

/** Resolve the best matching clip present in `manifest.actions`. */
export function resolveActionName(manifest: SpriteManifest | null | undefined, requested: string): string {
  const actions = manifest?.actions;
  if (!actions) return requested;
  if (actions[requested]) return requested;
  for (const candidate of ACTION_FALLBACKS[requested] ?? []) {
    if (actions[candidate]) return candidate;
  }
  return requested;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Vite infers `unknown` here; the cast is required.
const sheetUrls = import.meta.glob("@/assets/sprites/*/sheet.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Vite infers `unknown` here; the cast is required.
const manifests = import.meta.glob("@/assets/sprites/*/manifest.json", {
  eager: true,
  import: "default",
}) as Record<string, SpriteManifest>;

function keyFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 2];
}

const urlByKey = new Map<string, string>();
for (const [path, url] of Object.entries(sheetUrls)) urlByKey.set(keyFromPath(path), url);

const manifestByKey = new Map<string, SpriteManifest>();
for (const [path, manifest] of Object.entries(manifests)) manifestByKey.set(keyFromPath(path), manifest);

const cache = new Map<string, LoadedAtlas>();
let revision = 0;

function wrapFrame(frame: number, count: number): number {
  return ((Math.floor(frame) % count) + count) % count;
}

/** Pure frame math, exported so slicing invariants can be tested without a DOM. */
export function frameRectFor(
  manifest: SpriteManifest,
  direction: string,
  action: string,
  frame: number,
): FrameRect | null {
  if (!manifest.actions || !manifest.directions) return null;
  const actionMeta = manifest.actions[action];
  if (!actionMeta || actionMeta.frames < 1) return null;
  const directionIndex = manifest.directions.indexOf(direction);
  if (directionIndex < 0) return null;
  const row = actionMeta.row * manifest.directions.length + directionIndex;
  return {
    sx: wrapFrame(frame, actionMeta.frames) * manifest.cellW,
    sy: row * manifest.cellH,
    sw: manifest.cellW,
    sh: manifest.cellH,
  };
}

/** Pure static-sheet cell math, supporting 2D grid-wrapped static atlases. */
export function staticFrameRectFor(manifest: SpriteManifest, maskOrIndex = 0): FrameRect {
  const count = Math.max(1, manifest.frames ?? 1);
  const idx = wrapFrame(maskOrIndex, count);
  const cols = Math.max(1, manifest.columns ?? count);
  return {
    sx: (idx % cols) * manifest.cellW,
    sy: Math.floor(idx / cols) * manifest.cellH,
    sw: manifest.cellW,
    sh: manifest.cellH,
  };
}

export function getAtlasRevision(): number {
  return revision;
}

export function loadAtlas(entityKey: string): SpriteAtlas {
  const cached = cache.get(entityKey);
  if (cached) return cached;

  const manifest = manifestByKey.get(entityKey);
  const url = urlByKey.get(entityKey);
  let settle: () => void = () => undefined;
  const loaded = new Promise<void>((resolve) => { settle = resolve; });
  const atlas: LoadedAtlas = {
    ready: false,
    image: null,
    manifest: manifest ?? null,
    loaded,
    getFrame(direction, action, frame) {
      if (!atlas.ready || !manifest) return null;
      return frameRectFor(manifest, direction, resolveActionName(manifest, action), frame);
    },
    getStaticFrame(maskOrIndex = 0) {
      if (!atlas.ready || !manifest) return null;
      return staticFrameRectFor(manifest, maskOrIndex);
    },
  };
  cache.set(entityKey, atlas);

  if (!manifest || !url) {
    console.error(`No generated sprite assets found for "${entityKey}"; run npm run gen:sprites`);
    settle();
    return atlas;
  }
  if (typeof Image === "undefined") {
    settle();
    return atlas;
  }

  const image = new Image();
  atlas.image = image;
  image.onload = () => {
    atlas.ready = true;
    revision++;
    settle();
  };
  image.onerror = () => {
    console.error(`Failed to load sprite atlas for "${entityKey}" at ${url}`);
    settle();
  };
  image.src = url;
  return atlas;
}

export async function preloadAtlases(entityKeys: readonly string[]): Promise<void> {
  const pending = entityKeys.map((key) => {
    loadAtlas(key);
    return cache.get(key)?.loaded ?? Promise.resolve();
  });
  await Promise.all(pending);
}
