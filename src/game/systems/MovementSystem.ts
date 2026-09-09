import { TILE } from "../constants";
import { tileDefinition, type TileShape } from "../constants";
import { clamp } from "../math";

export interface SolidBody {
  x: number;
  y: number;
  r: number;
}

export interface MapCollisionState {
  width: number;
  height: number;
  wardTiles: Set<number>;
  wardUnlocked: boolean;
  tileAt: (tx: number, ty: number) => number | undefined;
}

export class MovementSystem {
  constructor(private readonly map: MapCollisionState) {}

  tileAtPx(x: number, y: number): number {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return -1;
    return ty * this.map.width + tx;
  }

  solidAtIdx(i: number): boolean {
    if (i < 0 || i >= this.map.width * this.map.height) return true;
    const tx = i % this.map.width;
    const ty = Math.floor(i / this.map.width);
    const tile = this.map.tileAt(tx, ty);
    if (tile === undefined || tileDefinition(tile).shape === "solid") return true;
    if (!this.map.wardUnlocked && this.map.wardTiles.has(i)) return true;
    return false;
  }

  triggerAtPx(x: number, y: number): string | undefined {
    const index = this.tileAtPx(x, y);
    if (index < 0) return undefined;
    const tile = this.map.tileAt(index % this.map.width, Math.floor(index / this.map.width));
    return tile === undefined ? undefined : tileDefinition(tile).trigger;
  }

  hitsSolid(x: number, y: number, r: number, previousY = y): boolean {
    const minX = Math.floor((x - r) / TILE);
    const maxX = Math.floor((x + r) / TILE);
    const minY = Math.floor((y - r) / TILE);
    const maxY = Math.floor((y + r) / TILE);
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const index = ty * this.map.width + tx;
        const tile = this.map.tileAt(tx, ty);
        const shape: TileShape = !this.map.wardUnlocked && this.map.wardTiles.has(index)
          ? "solid"
          : tile === undefined ? "solid" : tileDefinition(tile).shape;
        if (this.shapeHitsCircle(shape, tx, ty, x, y, r, previousY)) return true;
      }
    }
    return false;
  }

  private shapeHitsCircle(shape: TileShape, tx: number, ty: number, x: number, y: number, r: number, previousY: number): boolean {
    if (shape === "none" || shape === "trigger") return false;
    const left = tx * TILE;
    const top = ty * TILE;
    if (shape === "oneWayUp") {
      return y >= previousY && previousY + r <= top && y + r > top && x + r > left && x - r < left + TILE;
    }
    if (shape === "slopeUpLeft" || shape === "slopeUpRight") {
      const localX = clamp(x, left, left + TILE) - left;
      const surface = top + (shape === "slopeUpLeft" ? localX : TILE - localX);
      return x + r > left && x - r < left + TILE && y + r > surface && y - r < top + TILE;
    }
    const nearX = clamp(x, left, left + TILE);
    const nearY = clamp(y, top, top + TILE);
    return (x - nearX) ** 2 + (y - nearY) ** 2 < r ** 2;
  }

  moveX(e: SolidBody, dx: number) {
    if (!dx || !this.hitsSolid(e.x + dx, e.y, e.r)) { e.x += dx; return; }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      if (this.hitsSolid(e.x + dx * mid, e.y, e.r)) hi = mid;
      else lo = mid;
    }
    e.x += dx * lo;
  }

  moveY(e: SolidBody, dy: number) {
    if (!dy || !this.hitsSolid(e.x, e.y + dy, e.r, e.y)) { e.y += dy; return; }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      if (this.hitsSolid(e.x, e.y + dy * mid, e.r, e.y)) hi = mid;
      else lo = mid;
    }
    e.y += dy * lo;
  }

  moveEntity(e: SolidBody, dx: number, dy: number) {
    this.moveX(e, dx);
    this.moveY(e, dy);
  }

  clampToWorld(entity: SolidBody, worldWidth: number, worldHeight: number) {
    entity.x = clamp(entity.x, 0, Math.max(0, worldWidth - 1));
    entity.y = clamp(entity.y, 0, Math.max(0, worldHeight - 1));
  }
}
