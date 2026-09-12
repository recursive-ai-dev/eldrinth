import { TILE, T, tileDefinition } from "../constants";
import { rr, dot, DIRV, DIRA } from "../math";
import type { EnemyState, ItemState, PlayerState, ProjectileState } from "../core/WorldState";
import type { Dir, MapData } from "../types";
import { loadAtlas, type SpriteAtlas } from "./spriteAtlas";

export const TILE_SPRITE_KEY: Record<number, string> = {
  [T.GRASS]: "tile.grass", [T.DGRASS]: "tile.dgrass", [T.PATH]: "tile.path",
  [T.WATER]: "tile.water", [T.TREE]: "tile.tree", [T.ROCK]: "tile.rock",
  [T.RFLOOR]: "tile.rfloor", [T.RWALL]: "tile.rwall", [T.CRYSTAL]: "tile.crystal",
  [T.FLOWER]: "tile.flower", [T.BRIDGE]: "tile.bridge", [T.GRAVE]: "tile.grave",
  [T.BONES]: "tile.bones", [T.TALLGRASS]: "tile.tallgrass",
  [T.SPIREFLOOR]: "tile.spirefloor", [T.SAND]: "tile.sand", [T.LEDGE]: "tile.ledge",
  [T.SLOPE_UP_LEFT]: "tile.slope_up_left", [T.SLOPE_UP_RIGHT]: "tile.slope_up_right",
  [T.TRIGGER]: "tile.trigger",
};

const tileAtlases = new Map<number, SpriteAtlas>();
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

const ENTITY_SPRITE_KEY: Record<string, string> = {
  player: "player",
  wraith: "enemy.wraith",
  sentinel: "enemy.sentinel",
  adept: "enemy.adept",
  boss: "enemy.boss",
};

// Generated entity atlases use "front"/"right"/"back"/"left" facing rows;
// PlayerState tracks movement as "up"/"down"/"left"/"right".
const PLAYER_DIR_TO_SPRITE_DIRECTION: Record<Dir, string> = {
  up: "back",
  down: "front",
  left: "left",
  right: "right",
};

const entityAtlases = new Map<string, SpriteAtlas>();
function entityAtlasFor(entityKey: string): SpriteAtlas {
  let atlas = entityAtlases.get(entityKey);
  if (!atlas) {
    atlas = loadAtlas(entityKey);
    entityAtlases.set(entityKey, atlas);
  }
  return atlas;
}

/** Draws one animated entity frame centered at the current transform origin. */
function drawEntitySprite(
  ctx: CanvasRenderingContext2D,
  entityKey: string,
  direction: string,
  action: string,
  animT: number,
  fps: number,
  drawSize: number,
): boolean {
  const atlas = entityAtlasFor(ENTITY_SPRITE_KEY[entityKey] ?? entityKey);
  if (!atlas.ready || !atlas.image) return false;
  const frameIndex = Math.floor(animT * fps);
  const frame = atlas.getFrame(direction, action, frameIndex);
  if (!frame) return false;
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas.image, frame.sx, frame.sy, frame.sw, frame.sh,
    -drawSize / 2, -drawSize / 2, drawSize, drawSize,
  );
  ctx.imageSmoothingEnabled = prevSmoothing;
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

  constructor(private readonly map: MapData) {}

  warm(cam: { x: number; y: number }, viewW: number, viewH: number) {
    this.prepare(cam, viewW, viewH, CHUNK_GUARD);
  }

  drawGround(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, viewW: number, viewH: number) {
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
        drawTile(groundCtx, tile, x * TILE, y * TILE, tx * TILE, ty * TILE);
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
}

/* ----------------------------- tile rendering ----------------------------- */
export function drawTile(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, seedX = x, seedY = y) {
  const s = TILE;
  const atlas = tileAtlasFor(t);
  if (atlas?.ready && atlas.image) {
    const frame = atlas.getStaticFrame(0);
    if (frame) {
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlas.image, frame.sx, frame.sy, frame.sw, frame.sh, x, y, s, s);
      ctx.imageSmoothingEnabled = prevSmoothing;
      return;
    }
  }
  // Fallback while an atlas is still loading (or, in dev, missing): the
  // original flat fill keeps the game playable instead of showing a hole.
  void seedX;
  void seedY;
  ctx.fillStyle = "#1b2a17";
  ctx.fillRect(x, y, s, s);
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
  const action = e.telegraph ? "attack" : "walk";
  const animT = e.t;
  const drawn = drawEntitySprite(ctx, "wraith", "front", action, animT, 8, e.r * 2.2);
  if (drawn) return;
  ctx.fillStyle = e.hurt > 0 ? "#ffffff" : "rgba(150,225,180,0.6)";
  ctx.beginPath();
  ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSentinel(ctx: CanvasRenderingContext2D, e: EnemyState) {
  const action = e.telegraph ? "attack" : "walk";
  const animT = e.t;
  const drawn = drawEntitySprite(ctx, "sentinel", "front", action, animT, 8, e.r * 2.2);
  if (drawn) return;
  ctx.fillStyle = e.hurt > 0 ? "#fff" : "#2b313e";
  rr(ctx, -9, -10, 18, 16, 4);
  ctx.fill();
}

function drawAdept(ctx: CanvasRenderingContext2D, e: EnemyState) {
  const action = e.telegraph ? "attack" : "walk";
  const animT = e.t;
  const drawn = drawEntitySprite(ctx, "adept", "front", action, animT, 8, e.r * 2.2);
  if (drawn) return;
  ctx.fillStyle = e.hurt > 0 ? "#fff" : "#3a2150";
  ctx.beginPath();
  ctx.arc(0, 0, e.r, 0, Math.PI * 2);
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
  const action = e.telegraph ? "attack" : "walk";
  const animT = e.t;
  const drawn = drawEntitySprite(ctx, "boss", "front", action, animT, 8, e.r * 2.2);
  if (!drawn) {
    ctx.fillStyle = e.hurt > 0 ? "#fff" : danger ? "#3a2030" : "#16283a";
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
  const action = p.attacking ? "attack" : "walk";
  const animT = p.attacking ? p.attackDur - p.attackTimer : p.walkT / (Math.PI * 2);
  const direction = PLAYER_DIR_TO_SPRITE_DIRECTION[p.dir];
  const drawn = drawEntitySprite(ctx, "player", direction, action, animT, 8, TILE * 1.5);
  if (drawn) return;
  // Fallback: keep the original vector knight so a missing/loading atlas
  // never renders a blank player.
  const hurt = p.hurtFlash > 0;
  ctx.fillStyle = hurt ? "#ffd0d0" : "#16323e";
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(-11, 8, -7, 12);
  ctx.lineTo(7, 12);
  ctx.quadraticCurveTo(11, 8, 0, -2);
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
