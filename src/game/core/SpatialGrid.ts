export interface SpatialEntity {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface SpatialGridOptions {
  cellSize?: number;
}

export class SpatialGrid {
  private readonly cellSize: number;
  private readonly cells = new Map<string, Set<SpatialEntity>>();
  private readonly entities = new Set<SpatialEntity>();

  constructor(options: SpatialGridOptions = {}) {
    this.cellSize = options.cellSize ?? 64;
  }

  insert(entity: SpatialEntity): void {
    this.entities.add(entity);
    this.addToBuckets(entity);
  }

  remove(entity: SpatialEntity): void {
    this.entities.delete(entity);
    for (const key of this.getCellKeys(entity)) {
      const bucket = this.cells.get(key);
      if (!bucket) continue;
      bucket.delete(entity);
      if (bucket.size === 0) this.cells.delete(key);
    }
  }

  clear(): void {
    this.cells.clear();
    this.entities.clear();
  }

  rebuild(): void {
    this.cells.clear();
    for (const entity of this.entities) {
      this.addToBuckets(entity);
    }
  }

  queryCircle(x: number, y: number, radius: number): SpatialEntity[] {
    const result: SpatialEntity[] = [];
    const seen = new Set<SpatialEntity>();
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

    for (let cellY = minY; cellY <= maxY; cellY++) {
      for (let cellX = minX; cellX <= maxX; cellX++) {
        const key = `${cellX},${cellY}`;
        const bucket = this.cells.get(key);
        if (!bucket) continue;

        for (const entity of bucket) {
          if (seen.has(entity)) continue;
          const dx = entity.x - x;
          const dy = entity.y - y;
          if (dx * dx + dy * dy <= radius * radius) {
            seen.add(entity);
            result.push(entity);
          }
        }
      }
    }

    return result;
  }

  private addToBuckets(entity: SpatialEntity): void {
    for (const key of this.getCellKeys(entity)) {
      const bucket = this.cells.get(key);
      if (bucket) {
        bucket.add(entity);
      } else {
        this.cells.set(key, new Set([entity]));
      }
    }
  }

  private getCellKeys(entity: SpatialEntity): string[] {
    const minX = Math.floor((entity.x - entity.r) / this.cellSize);
    const maxX = Math.floor((entity.x + entity.r) / this.cellSize);
    const minY = Math.floor((entity.y - entity.r) / this.cellSize);
    const maxY = Math.floor((entity.y + entity.r) / this.cellSize);
    const keys: string[] = [];

    for (let cellY = minY; cellY <= maxY; cellY++) {
      for (let cellX = minX; cellX <= maxX; cellX++) {
        keys.push(`${cellX},${cellY}`);
      }
    }

    return keys;
  }
}
