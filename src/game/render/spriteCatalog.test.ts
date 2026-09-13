import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { T } from "../constants";
import { ENTITY_SPRITE_KEY, TILE_SPRITE_KEY } from "./renderer";

const SPRITES_ROOT = fileURLToPath(new URL("../../assets/sprites/", import.meta.url));

function assetExists(key: string): boolean {
  return existsSync(`${SPRITES_ROOT}${key}/sheet.png`)
    && existsSync(`${SPRITES_ROOT}${key}/manifest.json`);
}

describe("sprite catalog completeness", () => {
  it("has a renderer key and generated atlas for every tile value", () => {
    for (const [name, value] of Object.entries(T)) {
      const key = TILE_SPRITE_KEY[value];
      expect(key, `T.${name} has no sprite mapping`).toBeDefined();
      expect(assetExists(key), `T.${name} is missing generated assets for ${key}`).toBe(true);
    }
  });

  it("has generated assets for the player, every enemy, and every item", () => {
    for (const type of ["player", "wraith", "sentinel", "adept", "boss", "shard", "potion"]) {
      const key = ENTITY_SPRITE_KEY[type];
      expect(key, `${type} has no sprite mapping`).toBeDefined();
      expect(assetExists(key), `${type} is missing generated assets for ${key}`).toBe(true);
    }
  });
});
