import { TILE, T, tileDefinition } from "../constants";
import { rr, dot, hash2, DIRV, DIRA } from "../math";
import type { EnemyState, ItemState, PlayerState, ProjectileState } from "../core/WorldState";
import type { MapData } from "../types";
import { getAtlasRevision, loadAtlas, preloadAtlases, type SpriteAtlas } from "./spriteAtlas";

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
};

export const ENTITY_SPRITE_KEY: Record<string, string> = {
  player: "player",
  wraith: "enemy.wraith",
  sentinel: "enemy.sentinel",
  adept: "enemy.adept",
  boss: "enemy.boss",
  shard: "item.shard",
  potion: "item.potion",
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
  return preloadAtlases([
    ...Object.values(TILE_SPRITE_KEY),
    ...new Set(Object.values(ENTITY_SPRITE_KEY)),
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
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    -drawSize / 2, -drawSize / 2, drawSize, drawSize,
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
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    x - drawSize / 2, y - drawSize / 2, drawSize, drawSize,
  );
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
  cam: { x: number; y: number };
  time: number;
  wardUnlocked: boolean;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  particles: ParticleRenderState[];
  texts: FloatTextRenderState[];
  items: ItemState[];
  shakeMag: number;
  lastShakeX: number;
  lastShakeY: number;
}

const CHUNK_TILES = 16;
const CHUNK_PIXELS = CHUNK_TILES * TILE;
const CHUNK_GUARD = 1;
const MAX_CACHED_CHUNKS = 64;

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

  drawOverlay(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, viewW: number, viewH: number) {
    for (const [cx, cy] of this.chunkRange(cam, viewW, viewH, 0)) {
      const chunk = this.get(cx, cy);
      chunk.lastUsed = this.frame;
      ctx.drawImage(chunk.overlay, cx * CHUNK_PIXELS, cy * CHUNK_PIXELS);
    }
  }

  private prepare(cam: { x: number; y: number }, viewW: number, viewH: number, guard: number) {
    for (const [cx, cy] of this.chunkRange(cam, viewW, viewH, guard)) {
      const chunk = this.get(cx, cy);
      chunk.lastUsed = this.frame;
    }
    this.evict();
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
        drawTile(groundCtx, tile, x * TILE, y * TILE, tx * TILE, ty * TILE, this.wangMask(tx, ty, tile));
        if (tileDefinition(tile).tall) drawTallOverlay(overlayCtx, tile, x * TILE, y * TILE);
      }
    }
    const made = { ground, overlay, lastUsed: this.frame };
    this.chunks.set(key, made);
    return made;
  }

  private evict() {
    while (this.chunks.size > MAX_CACHED_CHUNKS) {
      let oldestKey: string | undefined;
      let oldest = Infinity;
      for (const [key, chunk] of this.chunks) {
        if (chunk.lastUsed < oldest) { oldest = chunk.lastUsed; oldestKey = key; }
      }
      if (!oldestKey) return;
      this.chunks.delete(oldestKey);
    }
  }

  private refreshForLoadedAtlases() {
    const current = getAtlasRevision();
    if (current === this.atlasRevision) return;
    this.atlasRevision = current;
    this.chunks.clear();
  }

  private wangMask(x: number, y: number, tile: number): number {
    if (tile !== T.GRASS && tile !== T.WATER) return 0;
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
    const variant = Math.floor(hash2(seedX, seedY) * 4);
    const frameIndex = (t === T.GRASS || t === T.WATER) ? wangMask * 4 + variant : variant;
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

/** The portion of a tall tile that must occlude actors below it. */
function drawTallOverlay(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number) {
  const s = TILE;
  ctx.save();
  if (tile === T.TREE) {
    ctx.fillStyle = "rgba(10, 25, 8, 0.58)";
    dot(ctx, x + s * 0.5, y + s * 0.34, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(31, 58, 22, 0.72)";
    dot(ctx, x + s * 0.4, y + s * 0.25, 8);
    ctx.fill();
  } else if (tile === T.ROCK || tile === T.RWALL || tile === T.GRAVE) {
    ctx.fillStyle = "rgba(24, 23, 31, 0.48)";
    ctx.fillRect(x + 2, y + s * 0.45, s - 4, s * 0.3);
  } else if (tile === T.CRYSTAL) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(110, 255, 245, 0.35)";
    ctx.beginPath();
    ctx.moveTo(x + s / 2, y + 4);
    ctx.lineTo(x + s * 0.72, y + s * 0.62);
    ctx.lineTo(x + s * 0.28, y + s * 0.62);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ----------------------------- render pipeline ----------------------------- */
export function renderGame(g: RenderState) {
  const ctx = g.ctx;
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
  ctx.translate(-Math.round(g.cam.x) + sx, -Math.round(g.cam.y) + sy);
  g.tileRenderer.drawGround(ctx, g.cam, g.viewW, g.viewH);
  drawWardBarrier(g, ctx);
  drawSortedWorldObjects(g, ctx);
  drawProjectiles(g, ctx);
  drawParticles(g, ctx);
  drawTexts(g, ctx);
  g.tileRenderer.drawOverlay(ctx, g.cam, g.viewW, g.viewH);
  ctx.restore();

  drawLighting(g);
  // There is deliberately no quest compass. Roads, notes, and landmarks are
  // the navigation system.
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
  const yo = Math.sin(it.t * 2) * 3;
  const x = it.x;
  const y = it.y + yo;
  const glowColor = it.type === "shard" ? "80,240,220" : "255,90,90";
  const glowRadius = it.type === "shard" ? 20 : 16;
  ctx.globalCompositeOperation = "lighter";
  const spriteGlow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
  spriteGlow.addColorStop(0, `rgba(${glowColor},0.52)`);
  spriteGlow.addColorStop(1, `rgba(${glowColor},0)`);
  ctx.fillStyle = spriteGlow;
  ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
  ctx.globalCompositeOperation = "source-over";
  if (drawStaticSprite(ctx, it.type, x, y, it.type === "shard" ? 30 : 28)) {
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

/** A shared sort pass keeps items, actors, and tall map overlays coherent. */
function drawSortedWorldObjects(g: RenderState, ctx: CanvasRenderingContext2D) {
  const objects: { y: number; draw: () => void }[] = [];
  for (const sign of g.map.signs) {
    const x = sign.x * TILE + TILE / 2, y = sign.y * TILE + TILE / 2;
    objects.push({ y, draw: () => {
      ctx.save();
      ctx.fillStyle = "#382b23";
      ctx.fillRect(x - 2, y - 4, 4, 13);
      ctx.fillStyle = "#b9a27b";
      ctx.strokeStyle = "#44362b";
      ctx.lineWidth = 2;
      ctx.fillRect(x - 10, y - 18, 20, 15);
      ctx.strokeRect(x - 10, y - 18, 20, 15);
      ctx.fillStyle = "#5e4d3a";
      for (let line = 0; line < 3; line++) ctx.fillRect(x - 6, y - 14 + line * 4, 12 - line * 2, 1);
      ctx.restore();
    } });
  }
  for (const fire of g.map.campfires) objects.push({ y: fire.y, draw: () => drawCampfire(g, ctx, fire.x, fire.y) });
  for (const item of g.items) if (!item.taken) objects.push({ y: item.y, draw: () => drawItem(g, ctx, item) });
  for (const enemy of g.enemies) objects.push({ y: enemy.y, draw: () => drawEnemy(ctx, enemy) });
  objects.push({ y: g.player.y, draw: () => drawPlayer(g, ctx) });
  objects.sort((a, b) => a.y - b.y);
  for (const object of objects) object.draw();
}

function drawCampfire(g: RenderState, ctx: CanvasRenderingContext2D, x: number, y: number) {
  const flicker = Math.sin(g.time * 11 + x) * 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y - 6, 2, x, y - 6, 34);
  glow.addColorStop(0, "rgba(255,190,85,0.72)");
  glow.addColorStop(1, "rgba(255,130,40,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 6, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#4b3020";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 7); ctx.lineTo(x + 10, y + 7);
  ctx.moveTo(x - 8, y + 11); ctx.lineTo(x + 8, y + 3);
  ctx.stroke();
  ctx.fillStyle = "#ffb14d";
  ctx.beginPath();
  ctx.moveTo(x, y + 5); ctx.quadraticCurveTo(x - 11, y - 5, x + flicker, y - 22); ctx.quadraticCurveTo(x + 13, y - 4, x, y + 5);
  ctx.fill();
  ctx.fillStyle = "#fff0ac";
  ctx.beginPath();
  ctx.arc(x, y - 5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}


function drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyState) {
  if (e.telegraph) drawTelegraph(ctx, e);
  if (e.type === "boss") return drawBoss(ctx, e);
  const a = e.dying > 0 ? Math.max(0, e.dying / 0.45) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.r * 0.6, e.r * 0.8, e.r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(e.x, e.y);
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
  ctx.translate(0, e.bob);
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
    ctx, "wraith", enemySpriteDirection(e), e.telegraph ? "attack" : "walk", e.t, e.r * 3.1,
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
    ctx, "sentinel", enemySpriteDirection(e), e.telegraph ? "attack" : "walk", e.t, e.r * 3.0,
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
  ctx.translate(0, Math.sin(e.t * 3) * 2);
  const oldFilter = ctx.filter;
  if (e.hurt > 0) ctx.filter = "brightness(2.2) saturate(0.2)";
  const spriteDrawn = drawEntitySprite(
    ctx, "adept", enemySpriteDirection(e), e.telegraph ? "attack" : "walk", e.t, e.r * 3.2,
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
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.r * 0.7, e.r, e.r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(e.x, e.y);
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
    ctx, "boss", enemySpriteDirection(e), e.telegraph ? "attack" : "walk", e.t, e.r * 3.15,
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
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + p.r * 0.7, p.r * 0.95, p.r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(p.x, p.y);
  const bob = p.dashing ? 0 : Math.sin(p.walkT) * 1.6;
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
  if (p.attacking) drawSword(ctx, p);
  ctx.restore();
}

function drawKnightBody(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const oldFilter = ctx.filter;
  if (p.hurtFlash > 0) ctx.filter = "brightness(2.2) saturate(0.15)";
  const animT = p.attacking ? p.attackDur - p.attackTimer : p.walkT / 16;
  const spriteDrawn = drawEntitySprite(
    ctx, "player", p.dir, p.attacking ? "attack" : "walk", animT, TILE * 1.35,
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
  const px = p.x - g.cam.x + g.lastShakeX;
  const py = p.y - g.cam.y + g.lastShakeY;
  const R = Math.max(g.viewW, g.viewH) * 0.62;
  const gr = ctx.createRadialGradient(px, py, 0, px, py, R);
  gr.addColorStop(0, "rgba(6,8,16,0)");
  gr.addColorStop(0.42, "rgba(7,9,18,0.1)");
  gr.addColorStop(0.72, "rgba(4,6,14,0.55)");
  gr.addColorStop(1, "rgba(2,3,9,0.9)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, g.viewW, g.viewH);
  ctx.globalCompositeOperation = "lighter";
  const tg = ctx.createRadialGradient(px, py, 0, px, py, R * 0.32);
  tg.addColorStop(0, "rgba(255,180,90,0.1)");
  tg.addColorStop(1, "rgba(255,180,90,0)");
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, g.viewW, g.viewH);
  ctx.globalCompositeOperation = "source-over";
}
