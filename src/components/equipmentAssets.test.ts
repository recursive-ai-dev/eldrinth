import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "@/assets/equipment/manifest.json";
import { COMBAT_TOOLS, RELICS } from "@/game/equipment";
import type { EquipmentIconId } from "./EquipmentIcon";

const ROOT = fileURLToPath(new URL("../assets/equipment/", import.meta.url));
const IDS: EquipmentIconId[] = [...COMBAT_TOOLS.map(tool => tool.id), ...RELICS.map(relic => relic.id), "lantern"];
const SHA256 = /^[a-f0-9]{64}$/;

describe("committed equipment sprite assets", () => {
  it("includes an icon for every available weapon, relic and the lantern", () => {
    expect(Object.keys(manifest.icons).sort()).toEqual([...IDS].sort());
    expect(readdirSync(ROOT).filter(file => file.endsWith(".png")).sort()).toEqual(IDS.map(id => `${id}.png`).sort());
  });

  it.each(IDS)("keeps %s intact without requiring Python or the source checkout", id => {
    const icon = manifest.icons[id];
    expect(icon.file).toBe(`${id}.png`);
    const png = readFileSync(`${ROOT}${icon.file}`);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual({ width: 32, height: 32 });
    expect([icon.width, icon.height]).toEqual([32, 32]);
    expect(png[24], "8-bit channels").toBe(8);
    expect(png[25], "RGBA color type").toBe(6);
    expect(icon.fileSha256).toMatch(SHA256);
    expect(createHash("sha256").update(png).digest("hex")).toBe(icon.fileSha256);
    expect(icon.pixelSha256).toMatch(SHA256);
    expect(icon.seed.startsWith(`eldrinth-equipment-${id}-`)).toBe(true);
  });

  it("retains distinct icons and reproducible upstream provenance", () => {
    expect(new Set(IDS.map(id => manifest.icons[id].pixelSha256)).size).toBe(IDS.length);
    expect(manifest.source.project).toBe("shed-dev-sprites");
    expect(manifest.source.license).toBe("Apache-2.0");
    expect(manifest.source.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(manifest.source.generatorSha256).toMatch(SHA256);
  });
});
