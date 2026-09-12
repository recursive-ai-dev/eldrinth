import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { T } from "../constants";
import { TILE_SPRITE_KEY } from "./renderer";

const SPRITES_ROOT = resolve(__dirname, "../../assets/sprites");

const ENTITY_KEYS = ["player", "enemy.wraith", "enemy.sentinel", "enemy.adept", "enemy.boss", "item.shard", "item.potion"];

function assetExists(key: string): boolean {
  return existsSync(resolve(SPRITES_ROOT, key, "sheet.png")) && existsSync(resolve(SPRITES_ROOT, key, "manifest.json"));
}

describe("sprite catalog completeness", () => {
  it("has a generated asset for every T tile value", () => {
    for (const [tName, tValue] of Object.entries(T)) {
      const key = TILE_SPRITE_KEY[tValue];
      expect(key, `T.${tName} has no entry in TILE_SPRITE_KEY`).toBeDefined();
      expect(assetExists(key), `T.${tName} -> "${key}" has no generated asset at ${SPRITES_ROOT}/${key}`).toBe(true);
    }
  });

  it("has a generated asset for every player/enemy/item entity", () => {
    for (const key of ENTITY_KEYS) {
      expect(assetExists(key), `"${key}" has no generated asset at ${SPRITES_ROOT}/${key}`).toBe(true);
    }
  });
});
