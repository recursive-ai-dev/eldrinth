import { LANTERN_LIGHT_RADIUS, type LanternRecord } from "../lantern";
import { TILE, T, tileDefinition } from "../constants";
import { rr, dot, hash2, DIRV, DIRA } from "../math";
import type { EnemyState, ItemState, PlayerState, ProjectileState } from "../core/WorldState";
import type { MapData, NpcData, SettlementState } from "../types";
import { getAtlasRevision, loadAtlas, preloadAtlases, type SpriteAtlas } from "./spriteAtlas";
import { drawExpeditionLandmark, expeditionOnMap } from "./expeditionLandmarks";

export const TILE_SPRITE_KEY: Record<number, string> = {
  [T.GRASS]: "tile.grass",
  [T.DGRASS]: "tile.dgrass",
  [T.PATH]: "tile.path",
  [T.WATER]: "tile.water",
  [T.TREE]: "tile.tree",
  [T.ROCK]: "tile.rock",
  [T.RFLOOR]: "tile.rfloor",
  [T.RWALL]: "tile.rwall",
  [T.CRYSTAL]: "tile.crystal",
  [T.FLOWER]: "tile.flower",
  [T.BRIDGE]: "tile.bridge",
  [T.GRAVE]: "tile.grave",
  [T.BONES]: "tile.bones",
  [T.TALLGRASS]: "tile.tallgrass",
  [T.SPIREFLOOR]: "tile.spirefloor",
  [T.SAND]: "tile.sand",
  [T.LEDGE]: "tile.ledge",
  [T.SLOPE_UP_LEFT]: "tile.slope_up_left",
  [T.SLOPE_UP_RIGHT]: "tile.slope_up_right",
  [T.TRIGGER]: "tile.trigger",
  [T.EMBERS]: "tile.embers",
  [T.HOUSE_WALL]: "tile.rfloor",
  [T.INTERIOR_FLOOR]: "tile.interior_floor",
  [T.INTERIOR_WALL]: "tile.interior_wall",
};

/**
 * World-space scale for the exploration camera. Keep this shared with the
 * engine's virtual viewport calculations: a zoomed renderer that still culls
 * against the unzoomed viewport causes visible seams at chunk boundaries.
 */
export const CAMERA_ZOOM = 1.5;

export const ENTITY_SPRITE_KEY: Record<string, string> = {
  player: "player",
  wraith: "enemy.wraith",
  sentinel: "enemy.sentinel",
  adept: "enemy.adept",
  boss: "enemy.boss",
  shard: "item.shard",
  potion: "item.potion",
  campfire: "prop.campfire",
  sign: "prop.sign",
  lantern: "prop.lantern",
  brazier: "prop.brazier",
  guard: "guard",
  refugee: "refugee",
  "house.oldstone": "prop.house.oldstone",
  "house.cinder": "prop.house.cinder",
  "house.coastal": "prop.house.coastal",
  "house.moor": "prop.house.moor",
};

const tileAtlases = new Map<number, SpriteAtlas>();
const entityAtlases = new Map<string, SpriteAtlas>();

function tileAtlasFor(tile: number): SpriteAtlas | null {
  const key = TILE_SPRITE_KEY[tile];
  if (!key) return null;
  let atlas = tileAtlases.get(tile);
  if (!atlas) {
    atlas = loadAtlas(key);
    tileAtlases.set(tile, atlas);
  }
  return atlas;
}

function entityAtlasFor(key: string): SpriteAtlas {
  const assetKey = ENTITY_SPRITE_KEY[key] ?? key;
  let atlas = entityAtlases.get(assetKey);
  if (!atlas) {
    atlas = loadAtlas(assetKey);
    entityAtlases.set(assetKey, atlas);
  }
  return atlas;
}

export function preloadGameSprites(): Promise<void> {
  const npcKeys = [
    "npc.orithel-the-last-watcher",
    "npc.scribe-althea",
    "npc.sister-mirene",
    "npc.barris-the-smith",
    "npc.kiln-master-vance",
    "npc.cinder-nurse-greta",
    "npc.elodie-outrunner",
    "npc.mistress-morveth",
    "npc.sister-lyra",
    "npc.kieran-blind-oar",
    "npc.reeve-toran",
    "npc.hermit-cassian",
    "npc.mina-drift-child",
  ];
  return preloadAtlases([
    ...Object.values(TILE_SPRITE_KEY),
    ...new Set(Object.values(ENTITY_SPRITE_KEY)),
    ...npcKeys,
  ]);
}

function toSpriteDirection(direction: string): string {
  if (direction === "up") return "back";
  if (direction === "down") return "front";
  return direction;
}

function enemySpriteDirection(enemy: EnemyState): string {
  if (Math.abs(enemy.vx) > Math.abs(enemy.vy)) return enemy.vx < 0 ? "left" : "right";
  if (Math.abs(enemy.vy) > 0.1) return enemy.vy < 0 ? "up" : "down";
  return "down";
}

function drawEntitySprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  direction: string,
  action: string,
  animT: number,
  drawSize: number,
): boolean {
  const atlas = entityAtlasFor(key);
  if (!atlas.ready || !atlas.image) return false;
  const frame = atlas.getFrame(toSpriteDirection(direction), action, Math.floor(animT * 8));
  if (!frame) return false;
  const size = Math.round(drawSize);
  const half = Math.round(size / 2);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    -half, -half, size, size,
  );
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}

function drawStaticSprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  drawSize: number,
): boolean {
  const atlas = entityAtlasFor(key);
  if (!atlas.ready || !atlas.image) return false;
  const frame = atlas.getStaticFrame();
  if (!frame) return false;
  const size = Math.round(drawSize);
  const half = Math.round(size / 2);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    Math.round(x) - half, Math.round(y) - half, size, size,
  );
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}

/** Draw a static atlas frame at a map-aligned top-left coordinate. */
function drawStaticSpriteBox(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const atlas = entityAtlasFor(key);
  if (!atlas.ready || !atlas.image) return false;
  const frame = atlas.getStaticFrame();
  if (!frame) return false;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas.image, frame.sx, frame.sy, frame.sw, frame.sh, x, y, width, height);
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}

export interface ParticleRenderState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "spark" | "shard" | "smoke" | "ring";
  rot: number;
}

export interface FloatTextRenderState {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
  size: number;
}

/** The complete rendering contract. Rendering has no dependency on the runtime coordinator. */
export interface RenderState {
  ctx: CanvasRenderingContext2D;
  map: MapData;
  tileRenderer: TileChunkRenderer;
  dpr: number;
  cssW: number;
  cssH: number;
  viewW: number;
  viewH: number;
  cameraZoom?: number;
  lanternOn?: boolean;
  lamplightRecord?: LanternRecord;
  revealedLamplightRecord?: LanternRecord;
  cam: { x: number; y: number };
  time: number;
  wardUnlocked: boolean;
  shards?: number;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  particles: ParticleRenderState[];
  texts: FloatTextRenderState[];
  items: ItemState[];
  settlementStates: SettlementState[];
  shakeMag: number;
  lastShakeX: number;
  lastShakeY: number;
}

const CHUNK_TILES = 16;
const CHUNK_PIXELS = CHUNK_TILES * TILE;
const CHUNK_GUARD = 1;
/**
 * Each chunk holds two 512x512 canvases, so one costs 2 MB of backing store.
 *
 * This was 128, which allowed 256 MB — and the 200x140 overworld is 117 chunks,
 * so simply walking across the frontier filled the cache to 234 MB (measured,
 * `npm run bench`) without ever triggering an eviction. iOS Safari enforces a
 * far lower per-page canvas budget than that and will kill the tab.
 *
 * The usual budget is 32 chunks / 64 MB. Offscreen guards only use spare
 * capacity. Large desktop windows can retain their visible set when it exceeds
 * that budget; repeatedly evicting visible chunks would rasterize them on
 * every frame even with a stationary camera.
 */
const MAX_CACHED_CHUNKS = 32;

interface RenderChunk {
  ground: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  lastUsed: number;
}

/**
 * Bounded, camera-driven raster cache. Map storage can be disk-backed or
 * procedural; only chunks around the active camera get a canvas allocation.
 */
export class TileChunkRenderer {
  private readonly chunks = new Map<string, RenderChunk>();
  private frame = 0;
  private atlasRevision = getAtlasRevision();

  constructor(private readonly map: MapData) {}

  warm(cam: { x: number; y: number }, viewW: number, viewH: number) {
    this.frame++;
    this.prepare(cam, viewW, viewH, CHUNK_GUARD);
  }

  drawGround(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, viewW: number, viewH: number) {
    this.refreshForLoadedAtlases();
    this.frame++;
    for (const [cx, cy] of this.chunkRange(cam, viewW, viewH, 0)) {
      const chunk = this.get(cx, cy);
      chunk.lastUsed = this.frame;
      ctx.drawImage(chunk.ground, cx * CHUNK_PIXELS, cy * CHUNK_PIXELS);
    }
    // Build the surrounding ring before crossing its boundary, so new chunks
    // are already rasterized when they become visible on the next frame.
    this.prepare(cam, viewW, viewH, CHUNK_GUARD);
  }

  /** Cached terrain rows join actors in the same ground-contact depth order. */
  collectOverlays(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, viewW: number, viewH: number, objects: WorldObject[]) {
    for (const [cx, cy] of this.chunkRange(cam, viewW, viewH, 0)) {
      const chunk = this.get(cx, cy);
      chunk.lastUsed = this.frame;
      for (let row = 0; row < CHUNK_TILES; row++) {
        const y = cy * CHUNK_PIXELS + row * TILE;
        if (y + TILE < cam.y || y > cam.y + viewH) continue;
        objects.push({ y: y + TILE, draw: () => {
          ctx.drawImage(chunk.overlay, 0, row * TILE, CHUNK_PIXELS, TILE,
            cx * CHUNK_PIXELS, y, CHUNK_PIXELS, TILE);
        } });
      }
    }
  }

  private prepare(cam: { x: number; y: number }, viewW: number, viewH: number, guard: number) {
    const visible = this.chunkRange(cam, viewW, viewH, 0);
    const visibleKeys = new Set(visible.map(([cx, cy]) => `${cx},${cy}`));
    const required = [...visible];
    for (const position of this.chunkRange(cam, viewW, viewH, guard)) {
      if (required.length >= MAX_CACHED_CHUNKS) break;
      if (!visibleKeys.has(`${position[0]},${position[1]}`)) required.push(position);
    }
    for (const [cx, cy] of required) {
      const chunk = this.get(cx, cy);
      chunk.lastUsed = this.frame;
    }
    this.evict(Math.max(MAX_CACHED_CHUNKS, visible.length));
  }

  private chunkRange(cam: { x: number; y: number }, viewW: number, viewH: number, guard: number): [number, number][] {
    const maxCx = Math.ceil(this.map.width / CHUNK_TILES) - 1;
    const maxCy = Math.ceil(this.map.height / CHUNK_TILES) - 1;
    const minX = Math.max(0, Math.floor(cam.x / CHUNK_PIXELS) - guard);
    const minY = Math.max(0, Math.floor(cam.y / CHUNK_PIXELS) - guard);
    const endX = Math.min(maxCx, Math.floor((cam.x + viewW - 1) / CHUNK_PIXELS) + guard);
    const endY = Math.min(maxCy, Math.floor((cam.y + viewH - 1) / CHUNK_PIXELS) + guard);
    const out: [number, number][] = [];
    for (let cy = minY; cy <= endY; cy++) for (let cx = minX; cx <= endX; cx++) out.push([cx, cy]);
    return out;
  }

  private get(cx: number, cy: number): RenderChunk {
    const key = `${cx},${cy}`;
    const cached = this.chunks.get(key);
    if (cached) return cached;
    const ground = document.createElement("canvas");
    const overlay = document.createElement("canvas");
    ground.width = overlay.width = CHUNK_PIXELS;
    ground.height = overlay.height = CHUNK_PIXELS;
    const groundCtx = ground.getContext("2d");
    const overlayCtx = overlay.getContext("2d");
    if (!groundCtx || !overlayCtx) throw new Error("Failed to create tile chunk canvas");
    const startX = cx * CHUNK_TILES;
    const startY = cy * CHUNK_TILES;
    for (let y = 0; y < CHUNK_TILES; y++) {
      for (let x = 0; x < CHUNK_TILES; x++) {
        const tx = startX + x;
        const ty = startY + y;
        if (tx >= this.map.width || ty >= this.map.height) continue;
        const tile = this.map.tiles[ty * this.map.width + tx];
        const mask = this.wangMask(tx, ty, tile);
        if (tileDefinition(tile).tall) {
          const floor = tile === T.RWALL || tile === T.INTERIOR_WALL ? T.RFLOOR : T.GRASS;
          drawTile(groundCtx, floor, x * TILE, y * TILE, tx * TILE, ty * TILE);
          drawTile(overlayCtx, tile, x * TILE, y * TILE, tx * TILE, ty * TILE, mask);
        } else {
          drawTile(groundCtx, tile, x * TILE, y * TILE, tx * TILE, ty * TILE, mask);
        }
      }
    }
    const made = { ground, overlay, lastUsed: this.frame };
    this.chunks.set(key, made);
    return made;
  }

  /**
   * Hand the backing store back immediately. Dropping the reference only makes
   * the canvases collectable, so a burst of chunk turnover can hold hundreds of
   * megabytes for a while after the entries are gone; zeroing the dimensions
   * frees the pixels at once.
   */
  private static release(chunk: RenderChunk) {
    chunk.ground.width = 0;
    chunk.ground.height = 0;
    chunk.overlay.width = 0;
    chunk.overlay.height = 0;
  }

  private evict(limit: number) {
    while (this.chunks.size > limit) {
      let oldestKey: string | undefined;
      let oldest = Infinity;
      for (const [key, chunk] of this.chunks) {
        if (chunk.lastUsed < oldest) { oldest = chunk.lastUsed; oldestKey = key; }
      }
      if (!oldestKey) return;
      TileChunkRenderer.release(this.chunks.get(oldestKey)!);
      this.chunks.delete(oldestKey);
    }
  }

  private refreshForLoadedAtlases() {
    const current = getAtlasRevision();
    if (current === this.atlasRevision) return;
    this.atlasRevision = current;
    for (const chunk of this.chunks.values()) TileChunkRenderer.release(chunk);
    this.chunks.clear();
  }

  private wangMask(x: number, y: number, tile: number): number {
    const atlas = tileAtlasFor(tile);
    const autotile = atlas?.manifest?.autotile ?? (tile === T.GRASS || tile === T.WATER);
    if (!autotile) return 0;
    const same = (xx: number, yy: number) => {
      if (xx < 0 || yy < 0 || xx >= this.map.width || yy >= this.map.height) return true;
      return this.map.tiles[yy * this.map.width + xx] === tile;
    };
    return (same(x, y - 1) ? 1 : 0)
      | (same(x + 1, y) ? 2 : 0)
      | (same(x, y + 1) ? 4 : 0)
      | (same(x - 1, y) ? 8 : 0);
  }
}

/* ----------------------------- tile rendering ----------------------------- */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  t: number,
  x: number,
  y: number,
  seedX = x,
  seedY = y,
  wangMask = 0,
) {
  const s = TILE;
  const atlas = tileAtlasFor(t);
  if (atlas?.ready && atlas.image) {
    const autotile = atlas.manifest?.autotile ?? (t === T.GRASS || t === T.WATER);
    const variant = Math.floor(hash2(seedX, seedY) * 4);
    const frameIndex = autotile ? wangMask * 4 + variant : variant;
    const frame = atlas.getStaticFrame(frameIndex);
    if (frame) {
      const smoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlas.image, frame.sx, frame.sy, frame.sw, frame.sh, x, y, s, s);
      ctx.imageSmoothingEnabled = smoothing;
      return;
    }
  }
  // Raster coordinates are chunk-local; variation remains globally stable so
  // a tile keeps the same appearance when its chunk is evicted and rebuilt.
  // The procedural branch below is a resilient loading/error fallback.
  const r = hash2(seedX, seedY);
  switch (t) {
    case T.GRASS: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#243619";
      if (r > 0.3) ctx.fillRect(x + ((r * 40) | 0) % s, y + ((r * 90) | 0) % s, 2, 2);
      if (r > 0.7) ctx.fillRect(x + ((r * 160) | 0) % s, y + ((r * 250) | 0) % s, 2, 2);
      break;
    }
    case T.DGRASS: {
      ctx.fillStyle = "#14200f";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#1c2c15";
      if (r > 0.4) ctx.fillRect(x + ((r * 40) | 0) % s, y + ((r * 90) | 0) % s, 2, 2);
      break;
    }
    case T.TALLGRASS: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = "#344f24";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const bx = x + 4 + ((r * (i + 1) * 37) | 0) % (s - 8);
        const by = y + s - 2 - ((r * (i + 1) * 13) | 0) % 6;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - 1, by - 6 - ((r * i * 7) | 0) % 5);
        ctx.stroke();
      }
      break;
    }
    case T.PATH: {
      ctx.fillStyle = "#3a2c1f";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#4a3a27";
      ctx.fillRect(x + ((r * 30) | 0) % s, y + ((r * 50) | 0) % s, 2, 2);
      ctx.fillStyle = "#2c2117";
      ctx.fillRect(x + ((r * 120) | 0) % s, y + ((r * 200) | 0) % s, 3, 2);
      break;
    }
    case T.SAND: {
      ctx.fillStyle = "#5a4a2f";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#6b5a3c";
      if (r > 0.4) ctx.fillRect(x + ((r * 40) | 0) % s, y + ((r * 70) | 0) % s, 2, 2);
      break;
    }
    case T.WATER: {
      ctx.fillStyle = "#102338";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#163049";
      ctx.fillRect(x, y + 6, s, 4);
      ctx.strokeStyle = "rgba(70,130,160,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + ((r * 20) | 0) % s);
      ctx.quadraticCurveTo(x + s / 4, y + 3, x + s / 2, y + ((r * 20) | 0) % s);
      ctx.moveTo(x + s / 2, y + 10 + ((r * 10) | 0) % s);
      ctx.quadraticCurveTo(x + (3 * s) / 4, y + 13, x + s, y + 10 + ((r * 10) | 0) % s);
      ctx.stroke();
      break;
    }
    case T.BRIDGE: {
      ctx.fillStyle = "#102338";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#3a2a1a";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#24180d";
      for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 8, s, 2);
      ctx.fillStyle = "#4a3422";
      ctx.fillRect(x, y, s, 2);
      ctx.fillRect(x, y + s - 2, s, 2);
      break;
    }
    case T.TREE: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#241712";
      ctx.fillRect(x + s * 0.43, y + s * 0.6, s * 0.14, s * 0.4);
      const cx = x + s * 0.5;
      const cy = y + s * 0.36;
      ctx.fillStyle = "#0f1d0b";
      dot(ctx, cx + 1, cy + 1, 12);
      ctx.fill();
      ctx.fillStyle = "#16280f";
      dot(ctx, cx, cy, 12);
      ctx.fill();
      ctx.fillStyle = "#1f3a16";
      dot(ctx, cx - 3, cy - 3, 8);
      ctx.fill();
      ctx.fillStyle = "#2a4d1d";
      dot(ctx, cx - 4, cy - 5, 4);
      ctx.fill();
      break;
    }
    case T.ROCK: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#33353f";
      rr(ctx, x + 5, y + 10, s - 10, s - 12, 6);
      ctx.fill();
      ctx.fillStyle = "#454754";
      rr(ctx, x + 7, y + 10, s - 16, 6, 4);
      ctx.fill();
      ctx.fillStyle = "#23242c";
      ctx.fillRect(x + 7, y + s - 8, s - 16, 4);
      ctx.fillStyle = "#3a5a2c";
      ctx.fillRect(x + 6, y + s - 12, 4, 3);
      break;
    }
    case T.RFLOOR: {
      ctx.fillStyle = "#2a2730";
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = "#1c1a22";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.beginPath();
      ctx.moveTo(x + s / 2, y);
      ctx.lineTo(x + s / 2, y + s);
      ctx.moveTo(x, y + s / 2);
      ctx.lineTo(x + s, y + s / 2);
      ctx.stroke();
      if (r > 0.7) {
        ctx.fillStyle = "#332f3a";
        ctx.fillRect(x + 8, y + 8, 4, 4);
      }
      break;
    }
    case T.RWALL: {
      ctx.fillStyle = "#231f2a";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#34303d";
      rr(ctx, x + 1, y + 1, s - 2, s - 3, 3);
      ctx.fill();
      ctx.strokeStyle = "#15121b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + s / 2);
      ctx.lineTo(x + s, y + s / 2);
      ctx.moveTo(x + s / 2, y);
      ctx.lineTo(x + s / 2, y + s / 2);
      ctx.stroke();
      ctx.fillStyle = "#3f3b4a";
      ctx.fillRect(x + 2, y + 2, s - 4, 3);
      break;
    }
    case T.SPIREFLOOR: {
      ctx.fillStyle = "#10141d";
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = "rgba(40,90,110,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
      ctx.strokeStyle = "rgba(60,150,170,0.25)";
      ctx.beginPath();
      ctx.moveTo(x + s / 2, y + 4);
      ctx.lineTo(x + s - 4, y + s / 2);
      ctx.lineTo(x + s / 2, y + s - 4);
      ctx.lineTo(x + 4, y + s / 2);
      ctx.closePath();
      ctx.stroke();
      if (r > 0.8) {
        ctx.fillStyle = "rgba(80,220,230,0.5)";
        ctx.fillRect(x + s / 2 - 1, y + s / 2 - 1, 2, 2);
      }
      break;
    }
    case T.CRYSTAL: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const cx0 = x + s / 2;
      const cy0 = y + s / 2;
      const g = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, 16);
      g.addColorStop(0, "rgba(60,230,220,0.5)");
      g.addColorStop(1, "rgba(60,230,220,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, s, s);
      ctx.restore();
      const cx = x + s / 2;
      const cy = y + s / 2 + 2;
      ctx.fillStyle = "#0c4a52";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 7, cy);
      ctx.lineTo(cx, cy + 8);
      ctx.lineTo(cx - 7, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2bd6cf";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 4, cy - 1);
      ctx.lineTo(cx, cy + 2);
      ctx.lineTo(cx - 4, cy - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#b6fff7";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 2, cy - 5);
      ctx.lineTo(cx, cy - 2);
      ctx.lineTo(cx - 2, cy - 5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case T.FLOWER: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
      const fx = x + 6 + ((r * 20) | 0) % (s - 12);
      const fy = y + 6 + ((r * 40) | 0) % (s - 12);
      const cols = ["#d7b4ff", "#ffd7e6", "#fff3b0", "#bfe9ff"];
      ctx.fillStyle = cols[Math.floor(r * 4) % 4];
      dot(ctx, fx, fy, 2);
      ctx.fill();
      ctx.fillStyle = "#2a4a1f";
      ctx.fillRect(fx - 0.5, fy, 1, 4);
      break;
    }
    case T.GRAVE: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#393a40";
      rr(ctx, x + s * 0.3, y + s * 0.35, s * 0.4, s * 0.5, 4);
      ctx.fill();
      ctx.fillStyle = "#2c2d33";
      ctx.fillRect(x + s * 0.45, y + s * 0.45, s * 0.1, s * 0.2);
      ctx.fillRect(x + s * 0.4, y + s * 0.5, s * 0.2, s * 0.07);
      break;
    }
    case T.BONES: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#c8c4b0";
      dot(ctx, x + s * 0.4, y + s * 0.55, 3);
      ctx.fill();
      ctx.fillRect(x + s * 0.4, y + s * 0.55, 8, 1.5);
      ctx.fillRect(x + s * 0.5, y + s * 0.4, 5, 1.5);
      break;
    }
    default: {
      ctx.fillStyle = "#1b2a17";
      ctx.fillRect(x, y, s, s);
    }
  }
}

/* ----------------------------- render pipeline ----------------------------- */

/**
 * Per-stage frame-time probe. The stage profiler in `bench/` assigns `fn` to
 * attribute a frame to individual pipeline stages; it is `undefined` during
 * normal play, so each `stage()` call is one property read the JIT folds away.
 * "pre" marks the frame start and is never accumulated, which lets the profiler
 * treat the first real stage as a full interval rather than a delta.
 */
export const __stageHook: { fn: ((name: string) => void) | undefined } = { fn: undefined };

function stage(name: string) {
  if (__stageHook.fn) __stageHook.fn(name);
}

export function renderGame(g: RenderState) {
  const ctx = g.ctx;
  stage("pre");
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  ctx.clearRect(0, 0, g.cssW, g.cssH);

  let sx = 0;
  let sy = 0;
  if (g.shakeMag > 0) {
    sx = (Math.random() * 2 - 1) * g.shakeMag;
    sy = (Math.random() * 2 - 1) * g.shakeMag;
    g.lastShakeX = sx;
    g.lastShakeY = sy;
  } else {
    g.lastShakeX = 0;
    g.lastShakeY = 0;
  }

  ctx.save();
  ctx.scale(g.cameraZoom ?? CAMERA_ZOOM, g.cameraZoom ?? CAMERA_ZOOM);
  ctx.translate(-Math.round(g.cam.x) + sx, -Math.round(g.cam.y) + sy);
  stage("ground");
  g.tileRenderer.drawGround(ctx, g.cam, g.viewW, g.viewH);
  stage("towns");
  stage("ward");
  drawWardBarrier(g, ctx);
  stage("objects");
  drawSortedWorldObjects(g, ctx);
  stage("projectiles");
  drawProjectiles(g, ctx);
  stage("particles");
  drawParticles(g, ctx);
  stage("texts");
  drawTexts(g, ctx);
  stage("overlay");
  ctx.restore();

  stage("lighting");
  drawLighting(g);
  stage("darkness");
  drawDarkness(g, ctx);
  // There is deliberately no quest compass. Roads, notes, and landmarks are
  // the navigation system.
}

/** Complete cottage props replace the old repeated-wall settlement silhouettes. */
function drawTownBuildings(g: RenderState, ctx: CanvasRenderingContext2D, objects: WorldObject[]) {
  for (const town of g.map.towns) {
    for (const building of town.buildings) {
      // Exterior layouts reserve a 3×3 footprint and place the door at its
      // bottom centre. Anchor the 96px frontage from that known door tile.
      const x = (building.x - 1) * TILE;
      const y = (building.y - 2) * TILE;
      objects.push({ y: y + TILE * 3, draw: () => {
        drawStaticSpriteBox(ctx, `house.${building.theme}`, x, y, TILE * 3, TILE * 3);
      } });
    }
  }
}

function drawSettlementState(g: RenderState, ctx: CanvasRenderingContext2D, objects: WorldObject[]) {
  for (const town of g.map.towns) {
    const state = g.settlementStates.find((entry) => entry.townId === town.id);
    if (!state) continue;

    const lampOffsets = [[-48, -36], [48, -36], [0, 32]];
    for (let index = 0; index < state.lamps; index++) {
      const [ox, oy] = lampOffsets[index];
      const x = town.x + ox;
      const y = town.y + oy;
      objects.push({ y: y + 8, draw: () => {
        const flicker = 0.9 + 0.1 * Math.sin(g.time * 5 + index * 1.7);
        const glow = ctx.createRadialGradient(x, y - 6, 2, x, y - 6, 26 * flicker);
        glow.addColorStop(0, "rgba(255,224,143,0.85)");
        glow.addColorStop(0.4, "rgba(255,181,72,0.3)");
        glow.addColorStop(1, "rgba(255,181,72,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y - 6, 26 * flicker, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(x, y);
        if (!drawEntitySprite(ctx, "lantern", "front", "idle", g.time * 2 + index * 0.5, 24)) {
          ctx.fillStyle = "#ffe49a";
          ctx.fillRect(-2, -2, 4, 4);
        }
        ctx.restore();
      } });
    }

    const refugeeOffsets = [[-48, 44], [0, 48], [48, 44]];
    for (let index = 0; index < state.refugees; index++) {
      const [ox, oy] = refugeeOffsets[index];
      const x = town.x + ox;
      const y = town.y + oy;
      objects.push({ y: y + 10, draw: () => {
        ctx.save();
        ctx.translate(x, y);
        if (!drawEntitySprite(ctx, "refugee", "front", "walk", g.time * 0.3 + index, 28)) {
          ctx.fillStyle = "#c9d6cf";
          ctx.beginPath();
          ctx.arc(0, -7, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6c8b82";
          ctx.fillRect(-4, -4, 8, 10);
        }
        ctx.restore();
      } });
    }

    if (state.closedBusinesses > 0) {
      const building = town.buildings[town.buildings.length - 1];
      const x = (building.x - 1) * TILE;
      const y = (building.y - 1) * TILE;
      objects.push({ y: (building.y + 1) * TILE, draw: () => {
        ctx.fillStyle = "rgba(32,24,24,0.82)";
        ctx.fillRect(x + 8, y + 35, TILE * 2 - 16, 18);
        ctx.strokeStyle = "#9b6b55";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 36);
        ctx.lineTo(x + TILE * 2 - 10, y + 52);
        ctx.moveTo(x + TILE * 2 - 10, y + 36);
        ctx.lineTo(x + 10, y + 52);
        ctx.stroke();
      } });
    }

    if (state.guarded) {
      const x = town.x - 88;
      const y = town.y + 4;
      objects.push({ y: y + 10, draw: () => {
        ctx.save();
        ctx.translate(x, y);
        if (!drawEntitySprite(ctx, "guard", "front", "walk", g.time * 0.35, 32)) {
          ctx.fillStyle = "#8b98a0";
          ctx.beginPath();
          ctx.arc(0, -12, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(-6, -7, 12, 18);
          ctx.strokeStyle = "#c7a56b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(8, -12);
          ctx.lineTo(8, 16);
          ctx.stroke();
        }
        ctx.restore();
      } });
    }
  }
}


const PLAYER_LIGHT_RADIUS = 96;
const BRAZIER_LIGHT_RADIUS = 176;
const darknessMasks = new WeakMap<CanvasRenderingContext2D, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();

export function drawDarkness(g: RenderState, ctx: CanvasRenderingContext2D) {
  if (!g.map.dark) return;
  let mask = darknessMasks.get(ctx);
  if (!mask) {
    const canvas = document.createElement("canvas");
    const maskContext = canvas.getContext("2d");
    if (!maskContext) return;
    mask = { canvas, ctx: maskContext };
    darknessMasks.set(ctx, mask);
  }
  const width = Math.max(1, Math.floor(g.cssW * g.dpr));
  const height = Math.max(1, Math.floor(g.cssH * g.dpr));
  if (mask.canvas.width !== width) mask.canvas.width = width;
  if (mask.canvas.height !== height) mask.canvas.height = height;
  const shade = mask.ctx;
  shade.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  shade.globalAlpha = 1;
  shade.globalCompositeOperation = "source-over";
  shade.clearRect(0, 0, g.cssW, g.cssH);
  const zoom = g.cameraZoom ?? CAMERA_ZOOM;
  shade.fillStyle = "rgba(2,3,6,0.93)";
  shade.fillRect(0, 0, g.cssW, g.cssH);

  // Erase only the darkness mask. Doing this on the main context would also
  // erase the floor and actors beneath each light, leaving transparent holes.
  shade.globalCompositeOperation = "destination-out";
  const punch = (x: number, y: number, radius: number) => {
    const hole = shade.createRadialGradient(x, y, radius * 0.15, x, y, radius);
    hole.addColorStop(0, "rgba(0,0,0,1)");
    hole.addColorStop(0.65, "rgba(0,0,0,0.55)");
    hole.addColorStop(1, "rgba(0,0,0,0)");
    shade.fillStyle = hole;
    shade.beginPath();
    shade.arc(x, y, radius, 0, Math.PI * 2);
    shade.fill();
  };
  const cameraX = Math.round(g.cam.x), cameraY = Math.round(g.cam.y);
  const px = (g.player.x - cameraX + g.lastShakeX) * zoom;
  const py = (g.player.y - cameraY + g.lastShakeY) * zoom;
  punch(px, py, (g.lanternOn ? LANTERN_LIGHT_RADIUS : PLAYER_LIGHT_RADIUS) * zoom);
  for (const light of g.map.lights) {
    punch(
      (light.x - cameraX + g.lastShakeX) * zoom,
      (light.y - cameraY + g.lastShakeY) * zoom,
      BRAZIER_LIGHT_RADIUS * zoom,
    );
  }
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(mask.canvas, 0, 0, g.cssW, g.cssH);
  ctx.restore();
}

function drawWardBarrier(g: RenderState, ctx: CanvasRenderingContext2D) {
  if (g.wardUnlocked) return;
  const W = g.map.width;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const wi of g.map.wardTiles) {
    const tx = wi % W;
    const ty = Math.floor(wi / W);
    const x = tx * TILE;
    const y = ty * TILE;
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 3 + tx);
    const grad = ctx.createLinearGradient(x, y, x, y + TILE);
    grad.addColorStop(0, "rgba(150,80,255,0)");
    grad.addColorStop(0.5, `rgba(170,110,255,${0.35 + 0.25 * pulse})`);
    grad.addColorStop(1, "rgba(150,80,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = `rgba(210,170,255,${0.5 + 0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + TILE / 2, y + 4);
    ctx.lineTo(x + TILE / 2, y + TILE - 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawItem(_g: RenderState, ctx: CanvasRenderingContext2D, it: ItemState) {
  ctx.save();
  const yo = Math.round(Math.sin(it.t * 2) * 3);
  const x = Math.round(it.x);
  const y = Math.round(it.y) + yo;
  const glowColor = it.type === "shard" ? "80,240,220" : "255,90,90";
  const glowRadius = it.type === "shard" ? 20 : 16;
  ctx.globalCompositeOperation = "lighter";
  const spriteGlow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
  spriteGlow.addColorStop(0, `rgba(${glowColor},0.52)`);
  spriteGlow.addColorStop(1, `rgba(${glowColor},0)`);
  ctx.fillStyle = spriteGlow;
  ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
  ctx.globalCompositeOperation = "source-over";
  if (drawStaticSprite(ctx, it.type, x, y, 24)) {
    ctx.restore();
    return;
  }
  if (it.type === "shard") {
      ctx.globalCompositeOperation = "lighter";
      const g1 = ctx.createRadialGradient(x, y, 0, x, y, 18);
      g1.addColorStop(0, "rgba(80,240,220,0.6)");
      g1.addColorStop(1, "rgba(80,240,220,0)");
      ctx.fillStyle = g1;
      ctx.fillRect(x - 18, y - 18, 36, 36);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#7ff7e6";
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 9);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#d8fff7";
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 3, y - 2);
      ctx.lineTo(x, y);
      ctx.lineTo(x - 3, y - 2);
      ctx.closePath();
      ctx.fill();
  } else {
      ctx.globalCompositeOperation = "lighter";
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, 14);
      g2.addColorStop(0, "rgba(255,90,90,0.5)");
      g2.addColorStop(1, "rgba(255,90,90,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(x - 14, y - 14, 28, 28);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#caa";
      ctx.fillRect(x - 3, y - 9, 6, 4);
      ctx.fillStyle = "#7a1f1f";
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 5);
      ctx.lineTo(x + 5, y - 5);
      ctx.lineTo(x + 4, y + 7);
      ctx.quadraticCurveTo(x, y + 10, x - 4, y + 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e24747";
      ctx.fillRect(x - 3, y - 2, 6, 7);
  }
  ctx.restore();
}

/** A fortress light source. Falls back to procedural flame if the atlas is absent. */
function drawBrazier(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (drawStaticSprite(ctx, "brazier", ix, iy, 32)) return;
  ctx.save();
  ctx.fillStyle = "#2a2320";
  ctx.fillRect(ix - 7, iy - 4, 14, 12);
  ctx.fillStyle = "#ffb14d";
  ctx.beginPath();
  ctx.moveTo(ix, iy - 16);
  ctx.quadraticCurveTo(ix + 6, iy - 6, ix, iy - 3);
  ctx.quadraticCurveTo(ix - 6, iy - 6, ix, iy - 16);
  ctx.fill();
  ctx.restore();
}

interface WorldObject { y: number; draw: () => void }

/** Ground contact determines occlusion for every actor and raised prop. */
function drawSortedWorldObjects(g: RenderState, ctx: CanvasRenderingContext2D) {
  const objects: WorldObject[] = [];
  g.tileRenderer.collectOverlays(ctx, g.cam, g.viewW, g.viewH, objects);
  drawTownBuildings(g, ctx, objects);
  drawSettlementState(g, ctx, objects);
  const record = g.lamplightRecord;
  if (record) objects.push({ y: record.y * TILE + TILE / 2, draw: () => {
    const x = record.x * TILE + TILE / 2, y = record.y * TILE + TILE / 2;
    const revealed = g.revealedLamplightRecord === record;
    ctx.save();
    drawStaticSprite(ctx, "sign", x, y, 32);
    // A scraped brass face is a landmark even with the lantern shuttered.
    ctx.fillStyle = revealed ? "#eed39d" : "#806b46";
    ctx.fillRect(x - 10, y - 13, 20, 14);
    ctx.strokeStyle = revealed ? "#fff3cc" : "#b69a65";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 10, y - 13, 20, 14);
    ctx.fillStyle = revealed ? "#634c2c" : "#a99267";
    if (revealed) {
      for (let row = 0; row < 3; row++) ctx.fillRect(x - 7, y - 10 + row * 4, 13 - row * 2, 1);
    } else {
      ctx.fillRect(x - 7, y - 6, 13, 1);
    }
    ctx.restore();
  } });
  const expedition = expeditionOnMap(g.map);
  if (expedition) objects.push({ y: expedition.y * TILE + TILE / 2, draw: () => drawExpeditionLandmark(ctx, expedition, g.time) });
  // Braziers are the light sources in the fortresses, and the darkness pass
  // already punches a hole for every entry in map.lights. They were preloaded
  // and keyed but never actually drawn, so every fortress was lit by an
  // invisible fire. Drawn here, in the depth-sorted pass, so a warden standing
  // behind one is occluded by it.
  for (const light of g.map.lights) {
    objects.push({ y: light.y, draw: () => drawBrazier(ctx, light.x, light.y) });
  }
  for (const sign of g.map.signs) {
    const x = sign.x * TILE + TILE / 2, y = sign.y * TILE + TILE / 2;
    objects.push({ y, draw: () => {
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (drawStaticSprite(ctx, "sign", ix, iy, 32)) return;
      ctx.save();
      ctx.fillStyle = "#382b23";
      ctx.fillRect(ix - 2, iy - 4, 4, 13);
      ctx.fillStyle = "#b9a27b";
      ctx.strokeStyle = "#44362b";
      ctx.lineWidth = 2;
      ctx.fillRect(ix - 10, iy - 18, 20, 15);
      ctx.strokeRect(ix - 10, iy - 18, 20, 15);
      ctx.fillStyle = "#5e4d3a";
      for (let line = 0; line < 3; line++) ctx.fillRect(ix - 6, iy - 14 + line * 4, 12 - line * 2, 1);
      ctx.restore();
    } });
  }
  for (const fire of g.map.campfires) objects.push({ y: fire.y, draw: () => drawCampfire(g, ctx, fire.x, fire.y) });
  for (const npc of g.map.npcs) {
    objects.push({
      y: npc.y + 10,
      draw: () => drawNpc(ctx, npc.x, npc.y, npc.color, npc.role, npc.portrait?.id, g.time, npc.name, g.player),
    });
  }
  if (g.map.npc.x > 0 && g.map.npc.y > 0) {
    objects.push({
      y: g.map.npc.y + 10,
      draw: () => drawNpc(ctx, g.map.npc.x, g.map.npc.y, "#9ff7e6", "lore", "orithel-the-last-watcher", g.time, "Orithel", g.player),
    });
  }
  for (const item of g.items) if (!item.taken) objects.push({ y: item.y, draw: () => drawItem(g, ctx, item) });
  for (const enemy of g.enemies) objects.push({ y: enemy.y + enemy.r, draw: () => drawEnemy(ctx, enemy) });
  objects.push({ y: g.player.y + g.player.r, draw: () => drawPlayer(g, ctx) });
  objects.sort((a, b) => a.y - b.y);
  for (const object of objects) object.draw();
}

function drawCampfire(g: RenderState, ctx: CanvasRenderingContext2D, x: number, y: number) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(ix, iy - 6, 2, ix, iy - 6, 36);
  glow.addColorStop(0, "rgba(255,190,85,0.75)");
  glow.addColorStop(0.5, "rgba(255,130,40,0.3)");
  glow.addColorStop(1, "rgba(255,130,40,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(ix, iy - 6, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.translate(ix, iy);
  if (drawEntitySprite(ctx, "campfire", "front", "idle", g.time, 32)) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const sparkT = (g.time * 2.5 + i * 0.7) % 2.0;
      const sparkY = -6 - sparkT * 14;
      const sparkX = Math.sin(g.time * 3 + i * 2.1) * (3 + sparkT * 3);
      const alpha = Math.max(0, 1 - sparkT / 2.0);
      ctx.fillStyle = `rgba(255,${Math.floor(180 + 60 * Math.sin(i))},80,${alpha})`;
      ctx.fillRect(sparkX - 0.5, sparkY - 0.5, 1.5, 1.5);
    }
    ctx.restore();
    return;
  }
  const flicker = Math.sin(g.time * 11 + x) * 2;
  ctx.strokeStyle = "#4b3020";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-10, 7); ctx.lineTo(10, 7);
  ctx.moveTo(-8, 11); ctx.lineTo(8, 3);
  ctx.stroke();
  ctx.fillStyle = "#ffb14d";
  ctx.beginPath();
  ctx.moveTo(0, 5); ctx.quadraticCurveTo(-11, -5, flicker, -22); ctx.quadraticCurveTo(13, -4, 0, 5);
  ctx.fill();
  ctx.fillStyle = "#fff0ac";
  ctx.beginPath();
  ctx.arc(0, -5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawNpc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  role?: NpcData["role"],
  portraitId?: string,
  time: number = 0,
  _name?: string,
  player?: PlayerState,
) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  const isOrithel = portraitId === "orithel-the-last-watcher";
  const floatY = isOrithel ? Math.sin(time * 2.5) * 3 - 3 : 0;

  ctx.save();
  // Shadow on floor
  ctx.fillStyle = isOrithel ? "rgba(70,210,195,0.22)" : "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(ix, iy + 9, isOrithel ? 10 : 8, isOrithel ? 4 : 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(ix, iy + floatY);

  const npcKey = portraitId ? `npc.${portraitId}` : undefined;
  let facingDir = "down";
  if (player) {
    const dx = player.x - x;
    const dy = player.y - y;
    if (Math.abs(dx) > Math.abs(dy)) {
      facingDir = dx < 0 ? "left" : "right";
    } else {
      facingDir = dy < 0 ? "up" : "down";
    }
  }

  if (npcKey && entityAtlasFor(npcKey).ready) {
    if (isOrithel) {
      // Ethereal projection aura
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const rad = ctx.createRadialGradient(0, -10, 2, 0, -10, 26);
      rad.addColorStop(0, "rgba(118,242,223,0.35)");
      rad.addColorStop(0.7, "rgba(60,168,154,0.12)");
      rad.addColorStop(1, "rgba(60,168,154,0)");
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(0, -10, 26, 0, Math.PI * 2);
      ctx.fill();

      // Fractured Spire Halo shards rotating
      ctx.fillStyle = "#a8f5ea";
      for (let i = 0; i < 4; i++) {
        const angle = time * 0.8 + (i * Math.PI) / 2;
        const hx = Math.cos(angle) * 12;
        const hy = -18 + Math.sin(angle) * 6;
        ctx.beginPath();
        ctx.moveTo(hx, hy - 3);
        ctx.lineTo(hx + 2, hy);
        ctx.lineTo(hx, hy + 3);
        ctx.lineTo(hx - 2, hy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (drawEntitySprite(ctx, npcKey, facingDir, "walk", time * 0.5, 32)) {
      ctx.restore();
      return;
    }
  }

  if (isOrithel) {
    // Ethereal projection aura
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rad = ctx.createRadialGradient(0, -10, 2, 0, -10, 26);
    rad.addColorStop(0, "rgba(118,242,223,0.35)");
    rad.addColorStop(0.7, "rgba(60,168,154,0.12)");
    rad.addColorStop(1, "rgba(60,168,154,0)");
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(0, -10, 26, 0, Math.PI * 2);
    ctx.fill();

    // Fractured Spire Halo shards rotating
    ctx.fillStyle = "#a8f5ea";
    for (let i = 0; i < 4; i++) {
      const angle = time * 0.8 + (i * Math.PI) / 2;
      const hx = Math.cos(angle) * 12;
      const hy = -18 + Math.sin(angle) * 6;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 3);
      ctx.lineTo(hx + 2, hy);
      ctx.lineTo(hx, hy + 3);
      ctx.lineTo(hx - 2, hy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Drifting white hair behind
    ctx.fillStyle = "#d8f5f0";
    ctx.beginPath();
    ctx.moveTo(-5, -16);
    ctx.quadraticCurveTo(-9 + Math.sin(time * 2) * 2, -4, -6, 6);
    ctx.lineTo(-2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, -16);
    ctx.quadraticCurveTo(9 + Math.sin(time * 2 + 1) * 2, -4, 6, 6);
    ctx.lineTo(2, 4);
    ctx.closePath();
    ctx.fill();

    // Translucent teal robes
    ctx.fillStyle = "#123d42";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(-9, -6, -8, 6);
    ctx.lineTo(-5, 14);
    ctx.lineTo(5, 14);
    ctx.lineTo(8, 6);
    ctx.quadraticCurveTo(9, -6, 0, -14);
    ctx.fill();

    // Gold-and-ivory collar
    ctx.fillStyle = "#e0c479";
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.lineTo(0, -6);
    ctx.lineTo(6, -11);
    ctx.lineTo(4, -13);
    ctx.lineTo(-4, -13);
    ctx.closePath();
    ctx.fill();

    // Ethereal head
    ctx.fillStyle = "#baf5ee";
    ctx.beginPath();
    ctx.arc(0, -17, 5, 0, Math.PI * 2);
    ctx.fill();

    // Glowing eyes
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-2, -18, 1.5, 1.5);
    ctx.fillRect(1, -18, 1.5, 1.5);
  } else {
    // Specific character rendering matching docs/npc-portrait-briefs.md
    switch (portraitId) {
      case "scribe-althea": {
        // Ochre hood & robe
        ctx.fillStyle = "#8a6122";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-9, -6, -9, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(9, 6);
        ctx.quadraticCurveTo(9, -6, 0, -14);
        ctx.fill();

        // Ochre hood
        ctx.fillStyle = "#b58434";
        ctx.beginPath();
        ctx.arc(0, -16, 6, 0, Math.PI * 2);
        ctx.fill();

        // Silver hair peeking out
        ctx.fillStyle = "#d2d6dc";
        ctx.fillRect(-3, -16, 6, 2);

        // Face
        ctx.fillStyle = "#e8cfb5";
        ctx.fillRect(-2.5, -14, 5, 4);

        // White quill feather pinned to hood
        ctx.strokeStyle = "#fdf8ee";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(3, -21);
        ctx.lineTo(1, -15);
        ctx.stroke();

        // Cracked brown ledger clutched in hands
        ctx.fillStyle = "#54341a";
        ctx.fillRect(3, -4, 6, 8);
        ctx.strokeStyle = "#c9a86c";
        ctx.lineWidth = 1;
        ctx.strokeRect(3, -4, 6, 8);
        break;
      }

      case "sister-mirene": {
        // Sea-green veil & flowing robes
        ctx.fillStyle = "#264f43";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-10, -6, -9, 8);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(9, 8);
        ctx.quadraticCurveTo(10, -6, 0, -14);
        ctx.fill();

        // Habit & veil
        ctx.fillStyle = "#3a7564";
        ctx.beginPath();
        ctx.arc(0, -16, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-5, -16, 10, 8);

        // Face
        ctx.fillStyle = "#d9ebe3";
        ctx.fillRect(-2.5, -14, 5, 3.5);

        // Black-glass beads
        ctx.strokeStyle = "#121816";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, -8, 4, 0, Math.PI);
        ctx.stroke();

        // Linen-wrapped hands with pulsing inner jade glow
        const glowA = 0.6 + Math.sin(time * 4) * 0.3;
        ctx.fillStyle = `rgba(143,252,202,${glowA})`;
        ctx.beginPath();
        ctx.arc(0, -2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d8ebe1";
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }

      case "barris-the-smith": {
        // Broad muscular frame & soot leather apron
        ctx.fillStyle = "#2e241c";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-11, -6, -11, 6);
        ctx.lineTo(-7, 14);
        ctx.lineTo(7, 14);
        ctx.lineTo(11, 6);
        ctx.quadraticCurveTo(11, -6, 0, -14);
        ctx.fill();

        // Leather apron
        ctx.fillStyle = "#5c3e24";
        ctx.fillRect(-5, -6, 10, 16);

        // Broken sword over shoulder
        ctx.strokeStyle = "#7a8594";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(6, -18);
        ctx.lineTo(10, 4);
        ctx.stroke();

        // Head with iron-grey beard
        ctx.fillStyle = "#c79c78";
        ctx.beginPath();
        ctx.arc(0, -16, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#656973";
        ctx.fillRect(-4, -15, 8, 5); // beard

        // Smith hammer at hip
        ctx.fillStyle = "#8a6428";
        ctx.fillRect(-9, -2, 2, 8);
        ctx.fillStyle = "#5a6470";
        ctx.fillRect(-11, -4, 6, 3);
        break;
      }

      case "kiln-master-vance": {
        // Charcoal cloak dusted with ash
        ctx.fillStyle = "#242228";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-9, -6, -9, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(9, 6);
        ctx.quadraticCurveTo(9, -6, 0, -14);
        ctx.fill();

        // Hood
        ctx.fillStyle = "#33303a";
        ctx.beginPath();
        ctx.arc(0, -16, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Copper half-mask
        ctx.fillStyle = "#b86c3b";
        ctx.fillRect(-3, -14, 6, 4);

        // Ember goggles (twin glowing dots)
        ctx.fillStyle = "#ff6a1a";
        ctx.fillRect(-3.5, -17, 3, 2.5);
        ctx.fillRect(0.5, -17, 3, 2.5);
        ctx.fillStyle = "#fff099";
        ctx.fillRect(-2.5, -16.5, 1, 1);
        ctx.fillRect(1.5, -16.5, 1, 1);

        // Tally hook cane in hand
        ctx.strokeStyle = "#826348";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(7, -8);
        ctx.lineTo(7, 14);
        ctx.stroke();
        ctx.strokeStyle = "#c99a47";
        ctx.beginPath();
        ctx.arc(7, -9, 2.5, Math.PI, 0);
        ctx.stroke();
        break;
      }

      case "cinder-nurse-greta": {
        // Rust-red coat
        ctx.fillStyle = "#7a2e22";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-9, -6, -9, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(9, 6);
        ctx.quadraticCurveTo(9, -6, 0, -14);
        ctx.fill();

        // Face with cropped dark hair
        ctx.fillStyle = "#241913";
        ctx.beginPath();
        ctx.arc(0, -16, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#dfaf92";
        ctx.fillRect(-2.5, -15, 5, 4);

        // Singed linen nurse cap
        ctx.fillStyle = "#ded6c8";
        ctx.fillRect(-4, -20, 8, 3.5);
        ctx.fillStyle = "#8a3224";
        ctx.fillRect(-1, -19.5, 2, 2);

        // Sulfur gloves
        ctx.fillStyle = "#d6c669";
        ctx.fillRect(-5, 0, 3, 4);
        ctx.fillRect(2, 0, 3, 4);

        // Blue glass flask at hip
        ctx.fillStyle = "#2b6fb5";
        ctx.beginPath();
        ctx.arc(6, 2, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case "elodie-outrunner": {
        // Wiry build in patched vermilion coat
        ctx.fillStyle = "#8f3227";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-8, -6, -8, 6);
        ctx.lineTo(-5, 14);
        ctx.lineTo(5, 14);
        ctx.lineTo(8, 6);
        ctx.quadraticCurveTo(8, -6, 0, -14);
        ctx.fill();

        // Ash-grey scarf with fluttering ends
        ctx.fillStyle = "#696c73";
        ctx.fillRect(-5, -11, 10, 3.5);
        const scarfFlutter = Math.sin(time * 6) * 2;
        ctx.beginPath();
        ctx.moveTo(4, -9);
        ctx.lineTo(8 + scarfFlutter, 2);
        ctx.lineTo(5 + scarfFlutter, 2);
        ctx.closePath();
        ctx.fill();

        // Head with shaved temple
        ctx.fillStyle = "#d49f7e";
        ctx.beginPath();
        ctx.arc(0, -16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#241913";
        ctx.fillRect(-4, -19, 5, 5); // left hair only

        // Hooked ravine staff
        ctx.strokeStyle = "#594638";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-7, -20);
        ctx.lineTo(-7, 14);
        ctx.stroke();
        ctx.strokeStyle = "#9c7c59";
        ctx.beginPath();
        ctx.arc(-9, -19, 2.5, 0, Math.PI);
        ctx.stroke();
        break;
      }

      case "mistress-morveth": {
        // Storm-water oilskin mantle
        ctx.fillStyle = "#2b4c57";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-10, -6, -10, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(10, 6);
        ctx.quadraticCurveTo(10, -6, 0, -14);
        ctx.fill();

        // Braided white hair over shoulder
        ctx.fillStyle = "#e8edf0";
        ctx.fillRect(3, -14, 3.5, 14);

        // Head
        ctx.fillStyle = "#cfab91";
        ctx.beginPath();
        ctx.arc(0, -16, 5, 0, Math.PI * 2);
        ctx.fill();

        // Brass dive goggles on forehead
        ctx.fillStyle = "#cca647";
        ctx.fillRect(-4, -19, 8, 2.5);

        // White name-tag stitched on sleeve
        ctx.fillStyle = "#f5f2e6";
        ctx.fillRect(-8, -2, 4, 3);
        break;
      }

      case "sister-lyra": {
        // Kelp-green layered robes
        ctx.fillStyle = "#245446";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-9, -6, -9, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(9, 6);
        ctx.quadraticCurveTo(9, -6, 0, -14);
        ctx.fill();

        // Shaved head & pearl ear cuffs
        ctx.fillStyle = "#dfbe9f";
        ctx.beginPath();
        ctx.arc(0, -16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f0f7f4";
        ctx.fillRect(-5.5, -16, 1.5, 1.5);
        ctx.fillRect(4, -16, 1.5, 1.5);

        // Netted satchel of glowing mint salve jars
        ctx.fillStyle = "#59e3aa";
        ctx.beginPath();
        ctx.arc(5, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1b4033";
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }

      case "kieran-blind-oar": {
        // Salt-bleached blue pea-coat
        ctx.fillStyle = "#2d425c";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-9, -6, -9, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(9, 6);
        ctx.quadraticCurveTo(9, -6, 0, -14);
        ctx.fill();

        // Rope coil across chest
        ctx.strokeStyle = "#ad9877";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-5, -6);
        ctx.lineTo(5, 4);
        ctx.stroke();

        // Head with clouded eye-wrap
        ctx.fillStyle = "#c79a7b";
        ctx.beginPath();
        ctx.arc(0, -16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d9d5cb";
        ctx.fillRect(-4, -17, 8, 2.5); // wrap

        // Long carved wooden oar held upright
        ctx.strokeStyle = "#6b4928";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(7, -22);
        ctx.lineTo(7, 14);
        ctx.stroke();
        ctx.fillStyle = "#8a6239";
        ctx.fillRect(5, -24, 4, 6);
        break;
      }

      case "reeve-toran": {
        // Deep violet mantle
        ctx.fillStyle = "#3a2554";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-9, -6, -9, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(9, 6);
        ctx.quadraticCurveTo(9, -6, 0, -14);
        ctx.fill();

        // Gaunt head & black hair
        ctx.fillStyle = "#1c1724";
        ctx.beginPath();
        ctx.arc(0, -16, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d9c2b0";
        ctx.fillRect(-2.5, -15, 5, 4);

        // Cracked brass monocle
        ctx.strokeStyle = "#cca647";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-3, -16, 3, 3);

        // Telescope lens cradled under arm
        ctx.fillStyle = "#ba923a";
        ctx.fillRect(4, -4, 5, 10);
        ctx.fillStyle = "#b0d8f5";
        ctx.beginPath();
        ctx.arc(6.5, -4, 2.5, Math.PI, 0);
        ctx.fill();
        break;
      }

      case "hermit-cassian": {
        // Plum hooded coat
        ctx.fillStyle = "#3d2847";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-9, -6, -9, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(9, 6);
        ctx.quadraticCurveTo(9, -6, 0, -14);
        ctx.fill();

        // Hood & silver beard
        ctx.fillStyle = "#4f335c";
        ctx.beginPath();
        ctx.arc(0, -16, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d1b297";
        ctx.fillRect(-2, -15, 4, 3);
        ctx.fillStyle = "#bdc3cc";
        ctx.fillRect(-3, -13, 6, 4); // beard

        // Meteorite bowl with shimmering starlight water
        ctx.fillStyle = "#29262e";
        ctx.fillRect(-3, 0, 6, 4);
        ctx.fillStyle = "#a28ded";
        ctx.fillRect(-2, -1, 4, 2);
        break;
      }

      case "mina-drift-child": {
        // Smaller child silhouette in charcoal cloak with meteor beads
        ctx.fillStyle = "#24222a";
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.quadraticCurveTo(-8, -4, -8, 6);
        ctx.lineTo(-5, 13);
        ctx.lineTo(5, 13);
        ctx.lineTo(8, 6);
        ctx.quadraticCurveTo(8, -4, 0, -11);
        ctx.fill();

        // Hood & pale braids
        ctx.fillStyle = "#33303a";
        ctx.beginPath();
        ctx.arc(0, -13, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ded7ec";
        ctx.fillRect(-4, -11, 2, 7);
        ctx.fillRect(2, -11, 2, 7);

        // Meteor-glass beads on cloak
        ctx.fillStyle = "#c8abfc";
        ctx.fillRect(-5, 4, 1.5, 1.5);
        ctx.fillRect(4, 5, 1.5, 1.5);
        ctx.fillRect(-1, 8, 1.5, 1.5);

        // Silver tuning fork held aloft
        ctx.strokeStyle = "#dbe0eb";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(6, -8);
        ctx.lineTo(6, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(6, -9, 2, 0, Math.PI);
        ctx.stroke();
        break;
      }

      default: {
        // Fallback: clean robed figure with role silhouette
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(-9, -6, -10, 6);
        ctx.lineTo(-6, 14);
        ctx.lineTo(6, 14);
        ctx.lineTo(10, 6);
        ctx.quadraticCurveTo(9, -6, 0, -14);
        ctx.fill();
        ctx.fillStyle = "#1a1c24";
        ctx.beginPath();
        ctx.arc(0, -16, 5, 0, Math.PI * 2);
        ctx.fill();
        if (role === "lore") {
          ctx.fillStyle = "rgba(255,240,205,0.72)";
          ctx.fillRect(5, -4, 5, 7);
        } else if (role === "healer") {
          ctx.strokeStyle = "rgba(255,240,205,0.72)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(7, 1, 3, 0, Math.PI * 2);
          ctx.stroke();
        } else if (role === "scout") {
          ctx.strokeStyle = "rgba(255,240,205,0.72)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-8, 9);
          ctx.lineTo(8, -8);
          ctx.stroke();
        }
        break;
      }
    }
  }

  // Floating proximity interaction indicator when player is near (< 48px)
  if (player && Math.hypot(player.x - x, player.y - y) < 48) {
    ctx.save();
    const promptBob = Math.sin(time * 5) * 1.5;
    const badgeY = -27 + promptBob;

    // Small translucent banner badge
    ctx.fillStyle = "rgba(12, 10, 18, 0.85)";
    ctx.strokeStyle = isOrithel ? "#76f2df" : color;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(-22, badgeY - 7, 44, 14, 3);
    } else {
      ctx.rect(-22, badgeY - 7, 44, 14);
    }
    ctx.fill();
    ctx.stroke();

    // Text: "[E] Talk"
    ctx.font = "bold 9px 'Cinzel', serif, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff0d4";
    ctx.fillText("[E] Talk", 0, badgeY);
    ctx.restore();
  }

  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyState) {
  if (e.telegraph) drawTelegraph(ctx, e);
  if (e.type === "boss") return drawBoss(ctx, e);
  const a = e.dying > 0 ? Math.max(0, e.dying / 0.45) : 1;
  const ex = Math.round(e.x);
  const ey = Math.round(e.y);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(ex, ey + Math.round(e.r * 0.6), Math.round(e.r * 0.8), Math.round(e.r * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(ex, ey);
  if (e.type === "wraith") drawWraith(ctx, e);
  else if (e.type === "sentinel") drawSentinel(ctx, e);
  else if (e.type === "adept") drawAdept(ctx, e);
  if (e.elite && e.alive) {
    ctx.strokeStyle = "#ffd36b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -e.r * 0.15, e.r + 5 + Math.sin(e.t * 4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffe6a3";
    ctx.fillRect(-9, -e.r - 10, 18, 3);
    ctx.fillStyle = "#d08f35";
    ctx.fillRect(-9, -e.r - 10, 18 * Math.max(0, e.hp / e.maxHp), 3);
  }
  ctx.restore();
}

function drawTelegraph(ctx: CanvasRenderingContext2D, e: EnemyState) {
  const pulse = 0.55 + Math.sin(e.t * 18) * 0.25;
  const color = e.telegraph === "spell" ? "190,110,255" : e.telegraph === "lunge" ? "255,90,90" : "70,210,255";
  const radius = e.telegraph === "spell" ? 24 : e.telegraph === "lunge" ? 42 : 58;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(${color},${pulse})`;
  ctx.lineWidth = e.telegraph === "burst" ? 3 : 2;
  ctx.setLineDash(e.telegraph === "spell" ? [4, 4] : [8, 5]);
  ctx.beginPath();
  ctx.arc(e.x, e.y, radius + Math.sin(e.t * 9) * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWraith(ctx: CanvasRenderingContext2D, e: EnemyState) {
  ctx.translate(0, Math.round(e.bob));
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 1.6);
  g.addColorStop(0, "rgba(90,210,150,0.4)");
  g.addColorStop(1, "rgba(90,210,150,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const oldFilter = ctx.filter;
  if (e.hurt > 0) ctx.filter = "brightness(2.2) saturate(0.2)";
  const spriteDrawn = drawEntitySprite(
    ctx, "wraith", enemySpriteDirection(e), e.telegraph ? "attack" : "walk", e.t, 32,
  );
  ctx.filter = oldFilter;
  if (spriteDrawn) return;
  ctx.fillStyle = e.hurt > 0 ? "#ffffff" : "rgba(150,225,180,0.6)";
  ctx.beginPath();
  ctx.moveTo(0, -e.r);
  ctx.quadraticCurveTo(e.r, -e.r * 0.4, e.r * 0.7, e.r * 0.6);
  ctx.lineTo(e.r * 0.4, e.r + Math.sin(e.t * 8) * 3);
  ctx.lineTo(0, e.r * 0.7);
  ctx.lineTo(-e.r * 0.4, e.r + Math.sin(e.t * 8 + 1) * 3);
  ctx.lineTo(-e.r * 0.7, e.r * 0.6);
  ctx.quadraticCurveTo(-e.r, -e.r * 0.4, 0, -e.r);
  ctx.fill();
  ctx.fillStyle = "#c8ffe6";
  ctx.beginPath();
  ctx.arc(-3, -3, 1.8, 0, Math.PI * 2);
  ctx.arc(3, -3, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawSentinel(ctx: CanvasRenderingContext2D, e: EnemyState) {
  const oldFilter = ctx.filter;
  if (e.hurt > 0) ctx.filter = "brightness(2.2) saturate(0.2)";
  const spriteDrawn = drawEntitySprite(
    ctx, "sentinel", enemySpriteDirection(e), e.telegraph ? "attack" : "walk", e.t, 32,
  );
  ctx.filter = oldFilter;
  if (spriteDrawn) return;
  const bob = Math.sin(e.t * 6) * 1.5;
  ctx.fillStyle = "#20242c";
  ctx.fillRect(-6, 4 + bob, 4, 7);
  ctx.fillRect(2, 4 - bob, 4, 7);
  ctx.translate(0, -2);
  ctx.fillStyle = e.hurt > 0 ? "#fff" : "#2b313e";
  rr(ctx, -9, -10, 18, 16, 4);
  ctx.fill();
  ctx.strokeStyle = "#11141b";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#363d4d";
  rr(ctx, -12, -10, 6, 5, 2);
  ctx.fill();
  rr(ctx, 6, -10, 6, 5, 2);
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  const cg = ctx.createRadialGradient(0, -2, 0, 0, -2, 8);
  cg.addColorStop(0, "rgba(90,235,220,0.9)");
  cg.addColorStop(1, "rgba(90,235,220,0)");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, -2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#5ff0da";
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(3, -2);
  ctx.lineTo(0, 2);
  ctx.lineTo(-3, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3a4150";
  ctx.beginPath();
  ctx.arc(0, -12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff5a5a";
  ctx.fillRect(-3, -13, 6, 1.6);
  void e;
}

function drawAdept(ctx: CanvasRenderingContext2D, e: EnemyState) {
  ctx.translate(0, Math.round(Math.sin(e.t * 3) * 2));
  const oldFilter = ctx.filter;
  if (e.hurt > 0) ctx.filter = "brightness(2.2) saturate(0.2)";
  const spriteDrawn = drawEntitySprite(
    ctx, "adept", enemySpriteDirection(e), e.telegraph ? "attack" : "walk", e.t, 32,
  );
  ctx.filter = oldFilter;
  if (spriteDrawn) return;
  ctx.fillStyle = e.hurt > 0 ? "#fff" : "#3a2150";
  ctx.beginPath();
  ctx.moveTo(0, -e.r);
  ctx.quadraticCurveTo(e.r, 0, e.r * 0.5, e.r);
  ctx.quadraticCurveTo(0, e.r * 0.7, -e.r * 0.5, e.r);
  ctx.quadraticCurveTo(-e.r, 0, 0, -e.r);
  ctx.fill();
  ctx.fillStyle = "#241436";
  ctx.beginPath();
  ctx.arc(0, -e.r * 0.5, e.r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(0, -e.r * 0.45, e.r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  const inten = e.shootCd < 0.4 ? 1 : 0.6;
  const og = ctx.createRadialGradient(0, e.r * 0.2, 0, 0, e.r * 0.2, 9);
  og.addColorStop(0, `rgba(200,120,255,${inten})`);
  og.addColorStop(1, "rgba(200,120,255,0)");
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(0, e.r * 0.2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#d9a6ff";
  ctx.beginPath();
  ctx.arc(0, e.r * 0.2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoss(ctx: CanvasRenderingContext2D, e: EnemyState) {
  const a = e.dying > 0 ? Math.max(0, e.dying / 1.5) : 1;
  const danger = e.hp / e.maxHp < 0.5;
  const bx = Math.round(e.x);
  const by = Math.round(e.y);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(bx, by + Math.round(e.r * 0.7), Math.round(e.r), Math.round(e.r * 0.45), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(bx, by);
  ctx.globalCompositeOperation = "lighter";
  const og = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 1.8);
  og.addColorStop(0, danger ? "rgba(255,60,60,0.35)" : "rgba(60,210,255,0.35)");
  og.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const oldFilter = ctx.filter;
  if (e.hurt > 0) ctx.filter = "brightness(2.2) saturate(0.2)";
  const spriteDrawn = drawEntitySprite(
    ctx, "boss", enemySpriteDirection(e), e.telegraph ? "attack" : "walk", e.t, 64,
  );
  ctx.filter = oldFilter;
  if (spriteDrawn) {
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.rotate(e.t * 0.6);
  ctx.strokeStyle = danger ? "rgba(255,120,120,0.6)" : "rgba(120,220,255,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a6 = (i / 6) * Math.PI * 2;
    ctx.moveTo(Math.cos(a6) * e.r * 0.9, Math.sin(a6) * e.r * 0.9);
    ctx.lineTo(Math.cos(a6) * e.r * 1.05, Math.sin(a6) * e.r * 1.05);
  }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.rotate(e.t * 0.3);
  drawCrystalShape(ctx, e.r, e.hurt > 0 ? "#fff" : danger ? "#3a2030" : "#16283a");
  ctx.restore();
  ctx.globalCompositeOperation = "lighter";
  const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 0.5);
  eg.addColorStop(0, danger ? "rgba(255,80,80,0.95)" : "rgba(120,230,255,0.95)");
  eg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrystalShape(ctx: CanvasRenderingContext2D, r: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.8, -r * 0.2);
  ctx.lineTo(r * 0.6, r * 0.8);
  ctx.lineTo(-r * 0.6, r * 0.8);
  ctx.lineTo(-r * 0.8, -r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.8, -r * 0.2);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(r * 0.6, r * 0.8);
  ctx.lineTo(-r * 0.6, r * 0.8);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer(g: RenderState, ctx: CanvasRenderingContext2D) {
  const p = g.player;
  const a = p.dying > 0 ? Math.max(0, p.dying / 0.9) : 1;
  const px = Math.round(p.x);
  const py = Math.round(p.y);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(px, py + Math.round(p.r * 0.7), Math.round(p.r * 0.95), Math.round(p.r * 0.45), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(px, py);
  // The burden remains visible on the road: one patient light per person.
  const carried = Math.min(9, g.shards ?? 0);
  if (carried > 0 && p.dying <= 0) {
    ctx.save();
    ctx.fillStyle = "#b9f0df";
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < carried; i++) {
      const angle = (i / 9) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 23, Math.sin(angle) * 18, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  const bob = p.dashing ? 0 : Math.round(Math.sin(p.walkT) * 1.5);
  ctx.translate(0, bob);
  if (p.dashing) {
    for (let i = 1; i <= 2; i++) {
      ctx.save();
      ctx.globalAlpha = a * 0.18;
      const [dx, dy] = DIRV[p.dashDir];
      ctx.translate(-dx * i * 6, -dy * i * 6);
      drawKnightBody(ctx, p);
      ctx.restore();
    }
  }
  if (p.invuln > 0 && !p.dashing && Math.floor(g.time * 20) % 2 === 0) ctx.globalAlpha = a * 0.5;
  drawKnightBody(ctx, p);
  if (g.lanternOn && p.dying <= 0) {
    ctx.save();
    ctx.globalAlpha = a;
    const glow = ctx.createRadialGradient(13, 7, 1, 13, 7, 30);
    glow.addColorStop(0, "rgba(255,211,135,.22)");
    glow.addColorStop(1, "rgba(255,211,135,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-17, -23, 60, 60);
    drawStaticSprite(ctx, "lantern", 13, 7, 24);
    ctx.restore();
  }
  if ((p.guardTimer ?? 0) > 0) {
    const [dx, dy] = DIRV[p.dir];
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.globalAlpha = .9;
    ctx.strokeStyle = "#fff0b6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, angle - Math.PI / 3, angle + Math.PI / 3);
    ctx.stroke();
    ctx.restore();
  } else if ((p.riposteTimer ?? 0) > 0) {
    ctx.save();
    ctx.globalAlpha = .65;
    ctx.strokeStyle = "#ffe09a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * (p.riposteTimer ?? 0));
    ctx.stroke();
    ctx.restore();
  }
  if (p.attacking) drawSword(ctx, p);
  ctx.restore();
}

function drawKnightBody(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const oldFilter = ctx.filter;
  if (p.hurtFlash > 0) ctx.filter = "brightness(2.2) saturate(0.15)";
  // Fit all four generated attack frames into the shorter gameplay swing.
  // Staying just below 0.5 s avoids wrapping the final frame back to zero.
  const attackProgress = 1 - p.attackTimer / p.attackDur;
  const animT = p.attacking ? Math.min(0.499, Math.max(0, attackProgress) * 0.5) : p.walkT / 16;
  const spriteDrawn = drawEntitySprite(
    ctx, "player", p.dir, p.attacking ? "attack" : "walk", animT, 32,
  );
  ctx.filter = oldFilter;
  if (spriteDrawn) return;
  const hurt = p.hurtFlash > 0;
  ctx.fillStyle = hurt ? "#ffd0d0" : "#16323e";
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(-11, 8, -7, 12);
  ctx.lineTo(7, 12);
  ctx.quadraticCurveTo(11, 8, 0, -2);
  ctx.fill();
  ctx.fillStyle = hurt ? "#fff" : "#1c2230";
  const lp = Math.sin(p.walkT) * 2;
  ctx.fillRect(-5, 8, 4, 5 + lp);
  ctx.fillRect(1, 8, 4, 5 - lp);
  ctx.fillStyle = hurt ? "#fff" : "#2b3344";
  rr(ctx, -7, -6, 14, 14, 4);
  ctx.fill();
  ctx.strokeStyle = "#0e1118";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#5a4a2a";
  ctx.fillRect(-7, 4, 14, 2);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
  cg.addColorStop(0, "rgba(70,240,220,0.9)");
  cg.addColorStop(1, "rgba(70,240,220,0)");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#5ff0da";
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(2.5, 0);
  ctx.lineTo(0, 3);
  ctx.lineTo(-2.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hurt ? "#fff" : "#3a4252";
  ctx.beginPath();
  ctx.arc(0, -9, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#16323e";
  ctx.beginPath();
  ctx.arc(0, -11, 5, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#bff7ff";
  const [fx, fy] = DIRV[p.dir];
  ctx.beginPath();
  ctx.arc(fx * 2, -9 + fy, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSword(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const prog = 1 - p.attackTimer / p.attackDur;
  const ang = DIRA[p.dir] + (-1.0 + prog * 2.0);
  ctx.save();
  ctx.rotate(ang);
  if (p.combatTool === "gravehammer") {
    const windingUp = (p.attackWindup ?? 0) > 0;
    ctx.strokeStyle = windingUp ? "rgba(255,196,110,0.4)" : "rgba(255,217,152,0.85)";
    ctx.lineWidth = windingUp ? 2 : 8;
    ctx.beginPath();
    ctx.arc(0, 0, 29, -0.95, 0.95);
    ctx.stroke();
    ctx.fillStyle = "#805d3b";
    ctx.fillRect(5, -2, 25, 4);
    ctx.fillStyle = windingUp ? "#9e9bac" : "#f1c889";
    ctx.fillRect(24, -9, 12, 18);
    ctx.strokeStyle = "#463e50";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, -9, 12, 18);
    ctx.restore();
    return;
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(200,230,255,${0.5 * (1 - prog * 0.3)})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 22, -0.95, 0.95);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#e9eef5";
  ctx.beginPath();
  ctx.moveTo(8, -3);
  ctx.lineTo(30, -1.5);
  ctx.lineTo(35, 0);
  ctx.lineTo(30, 1.5);
  ctx.lineTo(8, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#9aa6b5";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#b08d3e";
  ctx.fillRect(6, -4, 3, 8);
  ctx.restore();
}

function drawProjectiles(g: RenderState, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of g.projectiles) {
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.4);
    gr.addColorStop(0, p.color);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fff";
  for (const p of g.projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(g: RenderState, ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (const pr of g.particles) {
    const lf = pr.life / pr.max;
    ctx.globalAlpha = Math.max(0, Math.min(1, lf));
    if (pr.kind === "spark") {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.kind === "shard") {
      ctx.globalCompositeOperation = "lighter";
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.rot);
      ctx.fillStyle = pr.color;
      ctx.fillRect(-pr.size / 2, -pr.size / 2, pr.size, pr.size);
      ctx.restore();
    } else if (pr.kind === "smoke") {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 2;
      const rad = pr.size + (1 - lf) * 30;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function drawTexts(g: RenderState, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of g.texts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life / 1.1));
    ctx.font = `700 ${t.size}px 'EB Garamond', serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawLighting(g: RenderState) {
  const ctx = g.ctx;
  const p = g.player;
  const zoom = g.cameraZoom ?? CAMERA_ZOOM;
  const px = (p.x - g.cam.x + g.lastShakeX) * zoom;
  const py = (p.y - g.cam.y + g.lastShakeY) * zoom;
  const R = Math.max(g.viewW, g.viewH) * zoom * 0.62;
  // On dark maps drawDarkness supplies the ambient occlusion; the vignette
  // here would just re-darken the holes it punches, so skip it. The warm
  // torch-glow pass below is additive ("lighter") and only brightens, so it
  // cannot fight drawDarkness and stays on to give the player's own light a
  // warm tint in a fortress too.
  if (!g.map.dark) {
    const gr = ctx.createRadialGradient(px, py, 0, px, py, R);
    gr.addColorStop(0, "rgba(6,8,16,0)");
    gr.addColorStop(0.42, "rgba(7,9,18,0.1)");
    gr.addColorStop(0.72, "rgba(4,6,14,0.55)");
    gr.addColorStop(1, "rgba(2,3,9,0.9)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.cssW, g.cssH);
  }
  ctx.globalCompositeOperation = "lighter";
  const tg = ctx.createRadialGradient(px, py, 0, px, py, R * 0.32);
  tg.addColorStop(0, "rgba(255,180,90,0.1)");
  tg.addColorStop(1, "rgba(255,180,90,0)");
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, g.cssW, g.cssH);
  ctx.globalCompositeOperation = "source-over";
}
