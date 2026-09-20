import { describe, expect, it } from "vitest";
import { generateMap } from "./map";
import { TILE, SIGN_READ_RADIUS } from "./constants";
import { QUESTS, TOWN_PROJECTS } from "./quests";
import { wardenFact } from "./escalation";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";

/**
 * Every region the player can walk, minus town interiors (which hold no signs).
 */
const SIGN_REGIONS = [
  "overworld",
  "cinderwild",
  "moonlit-coast",
  "starfall-moors",
  ...Object.keys(FORTRESS_LAYOUTS),
];

/**
 * Which sign `Game.tryInteract` opens when the pilgrim stands on a tile: the
 * nearest one inside reading distance. Mirrored here so a map layout change
 * that buries a note fails this file instead of shipping.
 */
function signReadAt(map: ReturnType<typeof generateMap>, tileX: number, tileY: number) {
  const px = tileX * TILE + TILE / 2;
  const py = tileY * TILE + TILE / 2;
  let nearest: (typeof map.signs)[number] | null = null;
  let nearestDist = SIGN_READ_RADIUS;
  for (const sign of map.signs) {
    const dist = Math.hypot(px - (sign.x * TILE + TILE / 2), py - (sign.y * TILE + TILE / 2));
    if (dist >= nearestDist) continue;
    nearest = sign;
    nearestDist = dist;
  }
  return nearest;
}

describe("field signs", () => {
  it("never stacks two signs inside reading distance of one another", () => {
    const collisions: string[] = [];
    for (const regionId of SIGN_REGIONS) {
      const map = generateMap(regionId);
      for (let i = 0; i < map.signs.length; i++) {
        for (let j = i + 1; j < map.signs.length; j++) {
          const a = map.signs[i];
          const b = map.signs[j];
          const dist = Math.hypot((a.x - b.x) * TILE, (a.y - b.y) * TILE);
          if (dist < SIGN_READ_RADIUS) {
            collisions.push(`${regionId}: "${b.title}" at ${b.x},${b.y} is ${dist.toFixed(0)}px from "${a.title}" at ${a.x},${a.y}`);
          }
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it("reads as prose: no capitalised article or bare place name after 'toward'", () => {
    const bad: string[] = [];
    for (const regionId of SIGN_REGIONS) {
      for (const sign of generateMap(regionId).signs) {
        const match = sign.text.match(/toward\s+([^.,;]+)/);
        if (!match) continue;
        const destination = match[1].trim();
        if (/^(The|A|An)\s/.test(destination)) bad.push(`${regionId}: capitalized article — "toward ${destination}"`);
        if (!/^(the|a|an)\s/i.test(destination)) bad.push(`${regionId}: missing article — "toward ${destination}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("makes every quest and town-project requirement obtainable from the world", () => {
    // Facts a sign can teach, restricted to the sign the player would actually open.
    const readableFacts = new Set<string>();
    for (const regionId of SIGN_REGIONS) {
      const map = generateMap(regionId);
      for (let x = 0; x < map.width; x++) {
        for (let y = 0; y < map.height; y++) {
          const fact = signReadAt(map, x, y)?.fact;
          if (fact) readableFacts.add(fact);
        }
      }
    }

    // Facts granted by other authored systems: lorekeepers, warden kills, and
    // the Glass Reliquary mirrors.
    const obtainable = new Set<string>([
      ...readableFacts,
      ...Object.keys(FORTRESS_LAYOUTS).map(wardenFact),
      "pilgrim-ledger",
      "town:cinderwild:kilnmaster",
      "town:moonlit:dredger",
      "town:starfall:stargazer",
      "pilgrim-reflection",
    ]);

    const blocked: string[] = [];
    for (const quest of QUESTS) {
      const missing = quest.evidence.filter((entry) => !obtainable.has(entry.fact)).map((entry) => entry.fact);
      if (missing.length) blocked.push(`investigation "${quest.title}" can never be resolved; missing ${missing.join(", ")}`);
    }
    for (const project of TOWN_PROJECTS) {
      const missing = project.requirements.filter((fact) => !obtainable.has(fact));
      if (missing.length) blocked.push(`town project "${project.title}" can never be completed; missing ${missing.join(", ")}`);
    }

    expect(blocked).toEqual([]);
  });
});
