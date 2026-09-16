import { describe, expect, it, vi } from "vitest";
import { KNOWN_PORTRAIT_IDS } from "../../components/NpcPortraitView";
import { PORTRAIT_IMAGES } from "../../assets/portraits";
import { TILE, tileDefinition } from "../constants";
import { TOWN_RESIDENTS, generateMap } from "../map";
import { drawNpc } from "./renderer";
import type { PlayerState } from "../types";

function createMockContext() {
  const operations: { method: string; args: any[] }[] = [];
  const textDrawn: string[] = [];

  const ctx = {
    save: vi.fn(() => operations.push({ method: "save", args: [] })),
    restore: vi.fn(() => operations.push({ method: "restore", args: [] })),
    translate: vi.fn((x: number, y: number) => operations.push({ method: "translate", args: [x, y] })),
    scale: vi.fn((x: number, y: number) => operations.push({ method: "scale", args: [x, y] })),
    rotate: vi.fn((a: number) => operations.push({ method: "rotate", args: [a] })),
    beginPath: vi.fn(() => operations.push({ method: "beginPath", args: [] })),
    closePath: vi.fn(() => operations.push({ method: "closePath", args: [] })),
    moveTo: vi.fn((x: number, y: number) => operations.push({ method: "moveTo", args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => operations.push({ method: "lineTo", args: [x, y] })),
    quadraticCurveTo: vi.fn((cpx: number, cpy: number, x: number, y: number) => operations.push({ method: "quadraticCurveTo", args: [cpx, cpy, x, y] })),
    arc: vi.fn((x: number, y: number, r: number, sa: number, ea: number) => operations.push({ method: "arc", args: [x, y, r, sa, ea] })),
    ellipse: vi.fn((x: number, y: number, rx: number, ry: number, rot: number, sa: number, ea: number) => operations.push({ method: "ellipse", args: [x, y, rx, ry, rot, sa, ea] })),
    rect: vi.fn((x: number, y: number, w: number, h: number) => operations.push({ method: "rect", args: [x, y, w, h] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => operations.push({ method: "fillRect", args: [x, y, w, h] })),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) => operations.push({ method: "strokeRect", args: [x, y, w, h] })),
    fill: vi.fn(() => operations.push({ method: "fill", args: [] })),
    stroke: vi.fn(() => operations.push({ method: "stroke", args: [] })),
    fillText: vi.fn((text: string, x: number, y: number) => {
      textDrawn.push(text);
      operations.push({ method: "fillText", args: [text, x, y] });
    }),
    strokeText: vi.fn((text: string, x: number, y: number) => operations.push({ method: "strokeText", args: [text, x, y] })),
    measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowColor: "",
    shadowBlur: 0,
    lineCap: "butt",
  } as unknown as CanvasRenderingContext2D;

  return { ctx, operations, textDrawn };
}

describe("NPC Portraits and Registry", () => {
  it("contains exactly the 13 locked-in character portraits", () => {
    expect(KNOWN_PORTRAIT_IDS).toHaveLength(13);
    expect(KNOWN_PORTRAIT_IDS).toContain("orithel-the-last-watcher");
    expect(KNOWN_PORTRAIT_IDS).toEqual(expect.arrayContaining([
      "scribe-althea",
      "sister-mirene",
      "barris-the-smith",
      "kiln-master-vance",
      "cinder-nurse-greta",
      "elodie-outrunner",
      "mistress-morveth",
      "sister-lyra",
      "kieran-blind-oar",
      "reeve-toran",
      "hermit-cassian",
      "mina-drift-child",
    ]));
  });

  it("assigns unique, valid portraits and roles to all 12 regional town residents", () => {
    const towns = Object.entries(TOWN_RESIDENTS);
    expect(towns).toHaveLength(4);

    const allResidents = towns.flatMap(([, residents]) => residents);
    expect(allResidents).toHaveLength(12);

    const rolesFound: Record<string, number> = { lore: 0, healer: 0, scout: 0 };
    const portraitIds = new Set<string>();

    for (const resident of allResidents) {
      expect(resident.id).toBeDefined();
      expect(resident.name).toBeDefined();
      expect(resident.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(resident.portrait?.id).toBeDefined();
      expect(resident.portrait?.description.length).toBeGreaterThan(20);
      expect(KNOWN_PORTRAIT_IDS).toContain(resident.portrait?.id);

      rolesFound[resident.role] = (rolesFound[resident.role] ?? 0) + 1;
      portraitIds.add(resident.portrait!.id);
    }

    expect(rolesFound.lore).toBe(4);
    expect(rolesFound.healer).toBe(4);
    expect(rolesFound.scout).toBe(4);
    expect(portraitIds.size).toBe(12);
  });

  it("provides high-resolution portrait image assets for all 13 characters", () => {
    for (const id of KNOWN_PORTRAIT_IDS) {
      expect(PORTRAIT_IMAGES[id], `Missing image asset for ${id}`).toBeDefined();
    }
  });
});

describe("NPC World Map Presence", () => {
  const regions = [
    { regionId: "overworld", townName: "Ilyarael Township" },
    { regionId: "cinderwild", townName: "Cinder Haven" },
    { regionId: "moonlit-coast", townName: "Oarsman's Bight" },
    { regionId: "starfall-moors", townName: "Crater Watch" },
  ];

  for (const { regionId, townName } of regions) {
    it(`places all 3 regional NPCs in the exterior map for ${regionId} (${townName})`, () => {
      const map = generateMap(regionId);
      expect(map.npcs).toHaveLength(3);

      for (const npc of map.npcs) {
        expect(npc.name).toBeDefined();
        expect(npc.portrait?.id).toBeDefined();
        expect(npc.role).toBeDefined();

        // The tile where the NPC stands must be walkable
        const tileX = Math.floor(npc.x / TILE);
        const tileY = Math.floor(npc.y / TILE);
        const tileIndex = tileY * map.width + tileX;
        const tile = map.tiles[tileIndex];
        const def = tileDefinition(tile);

        expect(def.shape, `NPC ${npc.name} placed on solid tile ${tile} at (${tileX}, ${tileY})`).toBe("none");

        // The NPC should not directly block building doorways
        const nearDoorways = map.exits.filter((exit) =>
          exit.targetRegion.startsWith("interior.") && Math.hypot(exit.x - tileX, exit.y - tileY) < 1.5
        );
        expect(nearDoorways, `NPC ${npc.name} placed directly on or blocking an interior doorway`).toHaveLength(0);
      }
    });
  }
});

describe("In-World NPC Sprite Rendering", () => {
  it("renders distinct sprite artwork for each of the 13 locked characters without error", () => {
    for (const portraitId of KNOWN_PORTRAIT_IDS) {
      const { ctx, operations } = createMockContext();
      expect(() => {
        drawNpc(ctx, 100, 100, "#ffb259", "lore", portraitId, 1.5, "Test Speaker");
      }).not.toThrow();

      expect(operations.length).toBeGreaterThan(10);
    }
  });

  it("renders proximity interaction badge when player is nearby", () => {
    const { ctx, textDrawn } = createMockContext();
    const nearPlayer: PlayerState = {
      x: 110,
      y: 100,
      vx: 0,
      vy: 0,
      facing: "left",
      moving: false,
      hp: 18,
      maxHp: 18,
      stamina: 30,
      maxStamina: 30,
      r: 8,
      invuln: 0,
      attackCooldown: 0,
      swinging: false,
      swingTimer: 0,
      swingType: "slash",
      swingAngle: 0,
      dashing: false,
      dashCooldown: 0,
      dashDir: { x: 0, y: 0 },
      dodgeFrames: 0,
      staminaRegenCooldown: 0,
      shards: 0,
      keys: new Set(),
      potions: 0,
      totalPotionsFound: 0,
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      attacksMade: 0,
      deathCount: 0,
      totalPlayTime: 0,
    };

    drawNpc(ctx, 100, 100, "#c9a86c", "lore", "scribe-althea", 0, "Scribe Althea", nearPlayer);
    expect(textDrawn).toContain("[E] Talk");
  });

  it("does not render proximity interaction badge when player is far away", () => {
    const { ctx, textDrawn } = createMockContext();
    const farPlayer: PlayerState = {
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      facing: "left",
      moving: false,
      hp: 18,
      maxHp: 18,
      stamina: 30,
      maxStamina: 30,
      r: 8,
      invuln: 0,
      attackCooldown: 0,
      swinging: false,
      swingTimer: 0,
      swingType: "slash",
      swingAngle: 0,
      dashing: false,
      dashCooldown: 0,
      dashDir: { x: 0, y: 0 },
      dodgeFrames: 0,
      staminaRegenCooldown: 0,
      shards: 0,
      keys: new Set(),
      potions: 0,
      totalPotionsFound: 0,
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      attacksMade: 0,
      deathCount: 0,
      totalPlayTime: 0,
    };

    drawNpc(ctx, 100, 100, "#c9a86c", "lore", "scribe-althea", 0, "Scribe Althea", farPlayer);
    expect(textDrawn).not.toContain("[E] Talk");
  });
});

