import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import manifest from "@/assets/field-kit/manifest.json";
import SpriteIcon, { SPRITE_ICON_URLS, type SpriteIconId } from "./SpriteIcon";

const ROOT = fileURLToPath(new URL("../assets/field-kit/", import.meta.url));
const IDS = Object.keys(SPRITE_ICON_URLS) as SpriteIconId[];
const SHA256 = /^[a-f0-9]{64}$/;

describe("committed field kit art", () => {
  it("supplies a real asset and recipe for every guide and atlas icon", () => {
    expect(IDS.length).toBe(24);
    expect(Object.keys(manifest.icons).sort()).toEqual([...IDS].sort());
    expect(readdirSync(ROOT).filter(file => file.endsWith(".png")).sort()).toEqual(IDS.map(id => `${id}.png`).sort());
    expect(IDS.every(id => SPRITE_ICON_URLS[id].length > 0)).toBe(true);
  });

  it.each(IDS)("preserves the committed %s PNG and its checksum", id => {
    const icon = manifest.icons[id];
    const png = readFileSync(`${ROOT}${icon.file}`);
    expect(icon.file).toBe(`${id}.png`);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([32, 32]);
    expect([icon.width, icon.height]).toEqual([32, 32]);
    expect(png[24], "8-bit channels").toBe(8);
    expect(png[25], "RGBA encoding").toBe(6);
    expect(createHash("sha256").update(png).digest("hex")).toBe(icon.fileSha256);
    expect(icon.pixelSha256).toMatch(SHA256);
    expect(icon.seed.startsWith("eldrinth-")).toBe(true);
    expect(["none", "nearest"]).toContain(icon.resampling);
  });

  it("preserves distinct art, source attribution, and reproducible provenance", () => {
    expect(new Set(IDS.map(id => manifest.icons[id].pixelSha256)).size).toBe(IDS.length);
    expect(manifest.source.project).toBe("shed-dev-sprites");
    expect(manifest.source.license).toBe("Apache-2.0");
    expect(manifest.source.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(manifest.source.generatorSha256).toMatch(SHA256);
    expect(readFileSync(`${ROOT}LICENSE.apache-2.0`, "utf8")).toContain("Apache License");
    expect(readFileSync(`${ROOT}NOTICE.txt`, "utf8")).toContain("Shed Dev Sprites");
  });

  it("matches recognizable world enemy and pickup seeds", () => {
    for (const id of ["wraith", "sentinel", "adept", "boss"] as const) {
      expect(manifest.icons[id].seed).toBe(`eldrinth-${id}-01`);
    }
    expect(manifest.icons.shard.seed).toBe("eldrinth-item-shard-01");
    expect(manifest.icons.potion.seed).toBe("eldrinth-item-potion-01");
    expect(manifest.icons.boss.renderSize).toBe(64);
    expect(manifest.icons.boss.resampling).toBe("nearest");
  });
});

describe("SpriteIcon accessible meaning", () => {
  it("hides decorative art from screen readers beside an existing label", () => {
    const html = renderToStaticMarkup(<SpriteIcon id="journal" />);
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('draggable="false"');
  });

  it("exposes an explicit image label when there is no surrounding text", () => {
    const html = renderToStaticMarkup(<SpriteIcon id="campfire" label="Discovered wayfire" size={48} />);
    expect(html).toContain('alt="Discovered wayfire"');
    expect(html).not.toContain("aria-hidden");
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');
  });
});
