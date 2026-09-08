import { TILE } from "../constants";
import { clamp } from "../math";

export interface SolidBody {
  x: number;
  y: number;
  r: number;
}

export interface MapCollisionState {
  width: number;
  height: number;
  solid: Uint8Array;
  wardTiles: Set<number>;
  wardUnlocked: boolean;
  tileAtPx: (x: number, y: number) => number;
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
    if (i < 0 || i >= this.map.solid.length) return true;
    if (this.map.solid[i]) return true;
    if (!this.map.wardUnlocked && this.map.wardTiles.has(i)) return true;
    return false;
  }

  hitsSolid(x: number, y: number, r: number): boolean {
    const pts: [number, number][] = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
      [x, y],
    ];
    for (const [px, py] of pts) if (this.solidAtIdx(this.tileAtPx(px, py))) return true;
    return false;
  }

  moveX(e: SolidBody, dx: number) {
    const s = Math.sign(dx);
    let rem = Math.abs(dx);
    while (rem > 0) {
      const m = Math.min(2, rem);
      if (!this.hitsSolid(e.x + s * m, e.y, e.r)) e.x += s * m;
      else break;
      rem -= m;
    }
  }

  moveY(e: SolidBody, dy: number) {
    const s = Math.sign(dy);
    let rem = Math.abs(dy);
    while (rem > 0) {
      const m = Math.min(2, rem);
      if (!this.hitsSolid(e.x, e.y + s * m, e.r)) e.y += s * m;
      else break;
      rem -= m;
    }
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
