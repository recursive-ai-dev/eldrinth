export interface FrameRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface ActionMeta {
  row: number;
  frames: number;
}

interface Manifest {
  kind: "human" | "creature" | "item" | "tile";
  cellW: number;
  cellH: number;
  directions?: string[];
  actions?: Record<string, ActionMeta>;
  static: boolean;
  autotile?: boolean;
  masks?: number;
}

export interface SpriteAtlas {
  ready: boolean;
  image: HTMLImageElement | null;
  getFrame(direction: string, action: string, frame: number): FrameRect | null;
  getStaticFrame(maskOrIndex?: number): FrameRect | null;
}

const sheetUrls = import.meta.glob("@/assets/sprites/*/sheet.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const manifests = import.meta.glob("@/assets/sprites/*/manifest.json", {
  eager: true,
  import: "default",
}) as Record<string, Manifest>;

function keyFromPath(path: string): string {
  // "@/assets/sprites/enemy.wraith/sheet.png" -> "enemy.wraith"
  const parts = path.split("/");
  return parts[parts.length - 2];
}

const urlByKey = new Map<string, string>();
for (const [path, url] of Object.entries(sheetUrls)) urlByKey.set(keyFromPath(path), url);

const manifestByKey = new Map<string, Manifest>();
for (const [path, manifest] of Object.entries(manifests)) manifestByKey.set(keyFromPath(path), manifest);

const cache = new Map<string, SpriteAtlas>();

export function loadAtlas(entityKey: string): SpriteAtlas {
  const cached = cache.get(entityKey);
  if (cached) return cached;

  const manifest = manifestByKey.get(entityKey);
  const url = urlByKey.get(entityKey);
  const atlas: SpriteAtlas = {
    ready: false,
    image: null,
    getFrame(direction, action, frame) {
      if (!atlas.ready || !manifest?.actions || !manifest.directions) return null;
      const actionMeta = manifest.actions[action];
      if (!actionMeta) return null;
      const dirIndex = manifest.directions.indexOf(direction);
      if (dirIndex < 0) return null;
      const row = actionMeta.row * manifest.directions.length + dirIndex;
      const col = frame % actionMeta.frames;
      return {
        sx: col * manifest.cellW,
        sy: row * manifest.cellH,
        sw: manifest.cellW,
        sh: manifest.cellH,
      };
    },
    getStaticFrame(maskOrIndex = 0) {
      if (!atlas.ready || !manifest) return null;
      return {
        sx: maskOrIndex * manifest.cellW,
        sy: 0,
        sw: manifest.cellW,
        sh: manifest.cellH,
      };
    },
  };

  if (manifest && url) {
    const img = new Image();
    img.onload = () => {
      atlas.image = img;
      atlas.ready = true;
    };
    img.onerror = () => {
      // Development safety net only — every catalog entry ships a
      // generated asset (Task 12 enforces this in CI), so this path
      // should never be hit for shipped content.
      console.error(`Failed to load sprite atlas for "${entityKey}" at ${url}`);
    };
    img.src = url;
  } else {
    console.error(`No generated sprite assets found for "${entityKey}" — run npm run gen:sprites`);
  }

  cache.set(entityKey, atlas);
  return atlas;
}

export async function preloadAtlases(entityKeys: string[]): Promise<void> {
  const atlases = entityKeys.map(loadAtlas);
  await Promise.all(
    atlases.map(
      (atlas) =>
        new Promise<void>((resolve) => {
          if (atlas.ready) return resolve();
          const check = () => {
            if (atlas.ready || !atlas.image) return resolve();
            requestAnimationFrame(check);
          };
          check();
        }),
    ),
  );
}
