import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { T } from "../constants";
import { FORTRESS_EXTERIOR_SPRITE } from "./expeditionLandmarks";
import { ENTITY_SPRITE_KEY, REGIONAL_TILE_SPRITE_KEY, TILE_SPRITE_KEY } from "./renderer";
import type { SpriteManifest } from "./spriteAtlas";

const SPRITES_ROOT = fileURLToPath(new URL("../../assets/sprites/", import.meta.url));

function assetExists(key: string): boolean {
  return existsSync(`${SPRITES_ROOT}${key}/sheet.png`)
    && existsSync(`${SPRITES_ROOT}${key}/manifest.json`);
}

interface GeneratedManifest extends SpriteManifest {
  masks?: number;
  variants?: number;
  pixelHashes: string[] | Record<string, string[]>;
}

function pngDimensions(path: string): { width: number; height: number } {
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString("ascii"), `${path} is not a PNG`).toBe("PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("sprite catalog completeness", () => {
  it("has a renderer key and generated atlas for every tile value and regional variant", () => {
    for (const [name, value] of Object.entries(T)) {
      const key = TILE_SPRITE_KEY[value];
      expect(key, `T.${name} has no sprite mapping`).toBeDefined();
      expect(assetExists(key), `T.${name} is missing generated assets for ${key}`).toBe(true);
    }
    for (const [region, table] of Object.entries(REGIONAL_TILE_SPRITE_KEY)) {
      for (const [tile, key] of Object.entries(table)) {
        expect(key, `${region} tile ${tile} has undefined key`).toBeDefined();
        if (key) expect(assetExists(key), `${region} tile ${tile} is missing ${key}`).toBe(true);
      }
    }
  });

  it("has generated assets for actors, regional wardens, civic structures, and all 9 fortresses", () => {
    for (const type of [
      "player", "wraith", "sentinel", "adept", "boss",
      "warden.old-lands", "warden.cinderwild", "warden.moonlit-coast", "warden.starfall-moors",
      "shard", "potion", "campfire", "sign",
      "civic.hall", "civic.smithy", "civic.shrine", "civic.watchtower",
    ]) {
      const key = ENTITY_SPRITE_KEY[type];
      expect(key, `${type} has no sprite mapping`).toBeDefined();
      expect(assetExists(key), `${type} is missing generated assets for ${key}`).toBe(true);
    }
    expect(Object.keys(FORTRESS_EXTERIOR_SPRITE)).toHaveLength(9);
    for (const [fortressId, key] of Object.entries(FORTRESS_EXTERIOR_SPRITE)) {
      expect(assetExists(key), `${fortressId} is missing bespoke structure ${key}`).toBe(true);
    }
  });

  it("uses 47-tile Blob Wang autotiling on core terrain sets", () => {
    for (const key of ["tile.grass", "tile.path", "tile.water", "tile.rwall", "tile.sand"]) {
      const manifest = JSON.parse(readFileSync(`${SPRITES_ROOT}${key}/manifest.json`, "utf8")) as GeneratedManifest;
      expect(manifest.autotile, `${key} should be autotiled`).toBe(true);
      expect(manifest.masks, `${key} should use 47 Blob masks`).toBe(47);
      expect(manifest.autotileMode).toBe("blob47");
    }
  });

  it("keeps every PNG and manifest layout in sync", () => {
    const regionalKeys = Object.values(REGIONAL_TILE_SPRITE_KEY)
      .flatMap((table) => Object.values(table))
      .filter((key): key is string => Boolean(key));
    const keys = new Set([
      ...Object.values(TILE_SPRITE_KEY),
      ...regionalKeys,
      ...Object.values(ENTITY_SPRITE_KEY),
      ...Object.values(FORTRESS_EXTERIOR_SPRITE),
    ]);
    for (const key of keys) {
      const root = `${SPRITES_ROOT}${key}`;
      const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8")) as GeneratedManifest;
      const dimensions = pngDimensions(`${root}/sheet.png`);

      expect(manifest.cellW, `${key} has an invalid cell width`).toBeGreaterThan(0);
      expect(manifest.cellH, `${key} has an invalid cell height`).toBeGreaterThan(0);

      if (manifest.static) {
        const frames = manifest.frames ?? 0;
        const cols = manifest.columns ?? frames;
        const rows = Math.ceil(frames / Math.max(1, cols));
        expect(frames, `${key} has no static frames`).toBeGreaterThan(0);
        expect(dimensions).toEqual({ width: manifest.cellW * cols, height: manifest.cellH * rows });
        expect(dimensions.width, `${key} exceeds safe GPU atlas width`).toBeLessThanOrEqual(2048);
        expect(Array.isArray(manifest.pixelHashes) ? manifest.pixelHashes.length : -1).toBe(frames);
        if (manifest.autotile) {
          expect([16, 47], `${key} must contain Wang (16) or Blob (47) masks`).toContain(manifest.masks);
          expect(frames).toBe((manifest.masks ?? 0) * (manifest.variants ?? 0));
        }
        continue;
      }

      const directions = manifest.directions ?? [];
      const actions = manifest.actions ?? {};
      const actionEntries = Object.entries(actions);
      expect(directions.length, `${key} has no animation directions`).toBeGreaterThan(0);
      expect(actionEntries.length, `${key} has no animation actions`).toBeGreaterThan(0);
      const columns = Math.max(...actionEntries.map(([, action]) => action.frames));
      const actionRows = Math.max(...actionEntries.map(([, action]) => action.row)) + 1;
      expect(dimensions).toEqual({
        width: manifest.cellW * columns,
        height: manifest.cellH * directions.length * actionRows,
      });
      expect(Array.isArray(manifest.pixelHashes)).toBe(false);
      for (const [actionName, action] of actionEntries) {
        const hashes = (manifest.pixelHashes as Record<string, string[]>)[actionName] ?? [];
        expect(hashes.length, `${key}/${actionName} hash count`).toBe(directions.length * action.frames);
      }
    }
  });
});
