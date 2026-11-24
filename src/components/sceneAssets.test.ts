import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "@/assets/scenes/manifest.json";
import { REGION_SCENE_URLS, sceneIdForRegionName, type RegionSceneId } from "./RegionScene";

const ROOT = fileURLToPath(new URL("../assets/scenes/", import.meta.url));
const IDS = Object.keys(REGION_SCENE_URLS) as RegionSceneId[];
const SHA256 = /^[a-f0-9]{64}$/;

describe("committed regional landscape scenes", () => {
  it("supplies a 192x108 landscape banner for each of the four frontier regions", () => {
    expect(IDS).toHaveLength(4);
    expect(Object.keys(manifest.scenes).sort()).toEqual([...IDS].sort());
    expect(readdirSync(ROOT).filter((file) => file.endsWith(".png")).sort()).toEqual(
      IDS.map((id) => `${id}.png`).sort(),
    );
    expect(sceneIdForRegionName("The Old Lands")).toBe("old-lands");
    expect(sceneIdForRegionName("The Cinderwild")).toBe("cinderwild");
    expect(sceneIdForRegionName("Moonlit Coast")).toBe("moonlit-coast");
    expect(sceneIdForRegionName("The Starfall Moors")).toBe("starfall-moors");
  });

  it.each(IDS)("preserves the committed %s scene PNG, dimensions, and SHA-256", (id) => {
    const scene = manifest.scenes[id];
    const png = readFileSync(`${ROOT}${scene.file}`);
    expect(scene.file).toBe(`${id}.png`);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([192, 108]);
    expect([scene.width, scene.height]).toEqual([192, 108]);
    expect(createHash("sha256").update(png).digest("hex")).toBe(scene.fileSha256);
    expect(scene.pixelSha256).toMatch(SHA256);
  });

  it("preserves distinct regional artwork, source provenance, and Apache-2.0 notice", () => {
    expect(new Set(IDS.map((id) => manifest.scenes[id].pixelSha256)).size).toBe(IDS.length);
    expect(manifest.source.project).toBe("shed-dev-sprites");
    expect(manifest.source.license).toBe("Apache-2.0");
    expect(manifest.source.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(manifest.source.generatorSha256).toMatch(SHA256);
    expect(readFileSync(`${ROOT}LICENSE.apache-2.0`, "utf8")).toContain("Apache License");
    expect(readFileSync(`${ROOT}NOTICE.txt`, "utf8")).toContain("Shed Dev Sprites");
  });
});
