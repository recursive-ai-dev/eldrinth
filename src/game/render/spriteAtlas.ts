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
  kind: "human" | "creature" | "item" | "tile";
  cellW: number;
  cellH: number;
  directions?: string[];
  actions?: Record<string, ActionMeta>;
  static: boolean;
  autotile?: boolean;
  frames?: number;
}

export interface SpriteAtlas {
  ready: boolean;
  image: HTMLImageElement | null;
  getFrame(direction: string, action: string, frame: number): FrameRect | null;
  getStaticFrame(maskOrIndex?: number): FrameRect | null;
}

interface LoadedAtlas extends SpriteAtlas {
  loaded: Promise<void>;
}

const sheetUrls = import.meta.glob("@/assets/sprites/*/sheet.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

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
    loaded,
    getFrame(direction, action, frame) {
      if (!atlas.ready || !manifest) return null;
      return frameRectFor(manifest, direction, action, frame);
    },
    getStaticFrame(maskOrIndex = 0) {
      if (!atlas.ready || !manifest) return null;
      const count = Math.max(1, manifest.frames ?? 1);
      return {
        sx: wrapFrame(maskOrIndex, count) * manifest.cellW,
        sy: 0,
        sw: manifest.cellW,
        sh: manifest.cellH,
      };
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
