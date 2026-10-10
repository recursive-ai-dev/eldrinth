import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";
import { WorldState } from "./core/WorldState";
import { T, TILE } from "./constants";
import { equipmentEffects, normalizeEquippedRelics } from "./equipment";

beforeAll(() => installHeadlessDom());

async function arena() {
  const game = await bootGame();
  game.enemies = [];
  game.items = [];
  game.player.x = 20 * TILE + TILE / 2;
  game.player.y = 20 * TILE + TILE / 2;
  game.player.dir = "right";
  for (let y = 18; y <= 22; y++) {
    for (let x = 18; x <= 22; x++) game.map.tiles[y * game.map.width + x] = T.PATH;
  }
  return game;
}

describe("equipment and tool combat", () => {
  it("switches tools once per Q press and opens a frozen loadout with I", async () => {
    const game = await arena();
    game.setVirtualKey("q", true);
    game.simulateStep(1 / 60);
    expect(game.getEquipment().tool).toBe("gravehammer");
    game.simulateStep(1 / 60);
    expect(game.getEquipment().tool).toBe("gravehammer");
    game.setVirtualKey("i", true);
    const time = game.world.simulationTime;
    game.simulateStep(1 / 60);
    expect(game.paused).toBe(true);
    expect(game.world.simulationTime).toBe(time);
    game.setVirtualKey("i", true);
    game.simulateStep(1 / 60);
    expect(game.paused).toBe(false);
    game.destroy();
  });

  it("attunes newly found wayfire relics once and keeps their permanent gift", async () => {
    const game = await arena();
    const fire = game.map.campfires[0];
    game.player.x = fire.x;
    game.player.y = fire.y;
    const maxHp = game.player.maxHp;
    game.tryInteract();
    expect(game.player.relics).toContain("emberheart");
    expect(game.player.equippedRelics).toEqual(["emberheart"]);
    expect(game.player.maxHp).toBe(maxHp + 2);
    // Dialogue is a presentation gate; closing it does not repeat the grant.
    while (game.dialogue) {
      game.advanceLock = 0;
      game.advanceDialogue();
    }
    game.equipRelic("emberheart");
    game.tryInteract();
    expect(game.player.maxHp).toBe(maxHp + 2);
    expect(game.player.equippedRelics).toEqual([]);
    expect(game.player.relics).toEqual(["emberheart"]);
    game.destroy();
  });

  it("limits attunement to three owned, unique relics without altering permanent rewards", async () => {
    const game = await arena();
    expect(game.equipRelic("emberheart")).toBe(false);
    game.player.relics = ["emberheart", "ashstep", "tidewell", "starblade"];
    game.player.attackBonus = 4;
    const maxHp = game.player.maxHp;
    expect(game.equipRelic("emberheart")).toBe(true);
    expect(game.equipRelic("ashstep")).toBe(true);
    expect(game.equipRelic("tidewell")).toBe(true);
    expect(game.equipRelic("starblade")).toBe(false);
    expect(game.equipRelic("tidewell")).toBe(true);
    expect(game.equipRelic("starblade")).toBe(true);
    expect(game.getEquipment().equippedCount).toBe(3);
    expect(game.player.attackBonus).toBe(4);
    expect(game.player.maxHp).toBe(maxHp);
    game.destroy();
  });

  it("requires the hammer's stamina, wind-up and recovery before its stronger hit", async () => {
    const game = await arena();
    const enemy = game.makeEnemy("sentinel", game.player.x + 26, game.player.y);
    enemy.hp = enemy.maxHp = 20;
    game.enemies = [enemy];
    expect(game.setCombatTool("gravehammer")).toBe(true);
    game.player.stamina = 17;
    game.startAttack();
    expect(game.player.attacking).toBe(false);
    game.player.stamina = 100;
    game.startAttack();
    expect(game.player.stamina).toBe(82);
    expect(game.player.attackCd).toBeCloseTo(0.84);
    game.updatePlayer(0.1);
    expect(enemy.hp).toBe(20);
    game.updatePlayer(0.15);
    expect(enemy.hp).toBe(17);
    game.updatePlayer(0.1);
    expect(enemy.hp).toBe(17);
    expect(game.setCombatTool("wayblade")).toBe(false);
    game.startDash();
    expect(game.player.dashing).toBe(false);
    game.updatePlayer(0.1);
    expect(game.player.attacking).toBe(false);
    expect(game.setCombatTool("wayblade")).toBe(true);
    // Swapping to the light blade does not erase a heavy strike's recovery.
    game.startAttack();
    expect(game.player.attacking).toBe(false);
    game.destroy();
  });

  it("applies Starblade's additional damage and longer recovery together", async () => {
    const game = await arena();
    game.player.relics = ["starblade"];
    game.player.attackBonus = 2;
    game.equipRelic("starblade");
    game.startAttack();
    expect(game.player.swingDmg).toBe(4);
    expect(game.player.attackCd).toBeCloseTo(0.5);
    expect(game.player.stamina).toBe(100);
    game.destroy();
  });

  it("trades Tidewell's faster stamina recovery for slower walking", async () => {
    const game = await arena();
    game.player.relics = ["tidewell"];
    game.equipRelic("tidewell");
    game.player.stamina = 0;
    const startX = game.player.x;
    game.setVirtualKey("d", true);
    game.updatePlayer(0.1);
    expect(game.player.stamina).toBeCloseTo(4);
    expect(game.player.x - startX).toBeCloseTo(game.player.speed * 0.88 * 0.1);
    game.destroy();
  });

  it("uses Emberheart's finite stamina ward and still takes damage when exhausted", async () => {
    const game = await arena();
    game.player.relics = ["emberheart"];
    game.equipRelic("emberheart");
    const hp = game.player.hp;
    game.player.stamina = 18;
    game.damagePlayer(2, game.player.x - 20, game.player.y);
    expect(game.player.hp).toBe(hp - 1);
    expect(game.player.stamina).toBe(0);
    game.player.invuln = 0;
    game.damagePlayer(2, game.player.x - 20, game.player.y);
    expect(game.player.hp).toBe(hp - 3);
    expect(equipmentEffects(game.player).dashCost).toBe(41);
    game.destroy();
  });

  it("reflects bolts during Ashstep dashes, then hits enemies without hitting the player", async () => {
    const game = await arena();
    game.player.relics = ["ashstep"];
    game.equipRelic("ashstep");
    game.startDash();
    expect(game.player.stamina).toBe(57);
    const hp = game.player.hp;
    const enemy = game.makeEnemy("sentinel", game.player.x + 34, game.player.y);
    game.enemies = [enemy];
    game.projectiles = [{ x: game.player.x + 2, y: game.player.y, vx: -100, vy: 0, r: 6, dmg: 2, life: 2, color: "white" }];
    game.updateProjectiles(0.01);
    expect(game.projectiles[0].friendly).toBe(true);
    expect(game.projectiles[0].vx).toBe(100);
    game.player.dashing = false;
    game.player.invuln = 0;
    game.updateProjectiles(0.01);
    expect(game.player.hp).toBe(hp);
    game.updateProjectiles(0.2);
    expect(enemy.hp).toBe(enemy.maxHp - 2);
    expect(game.projectiles).toHaveLength(0);
    game.destroy();
  });

  it("keeps terrain collision ahead of bolt reflection", async () => {
    const game = await arena();
    game.player.relics = ["ashstep"];
    game.equipRelic("ashstep");
    game.startDash();
    game.map.tiles[20 * game.map.width + 20] = T.ROCK;
    game.projectiles = [{ x: game.player.x, y: game.player.y, vx: 0, vy: 0, r: 6, dmg: 2, life: 2, color: "white" }];
    game.updateProjectiles(0.01);
    expect(game.projectiles).toHaveLength(0);
    game.destroy();
  });
});

describe("equipment checkpoints", () => {
  it("loads old saves without attunement or changes to earned bonuses", async () => {
    const game = await arena();
    game.player.relics = ["emberheart", "ashstep", "tidewell", "starblade"];
    game.player.maxHp = 20;
    game.player.maxStamina = 125;
    game.player.dashCostDiscount = 12;
    game.player.attackBonus = 3;
    const legacy = game.saveWorld();
    delete legacy.player.equippedRelics;
    delete legacy.player.combatTool;
    delete legacy.player.attackWindup;
    const restored = new WorldState();
    restored.restore(legacy);
    expect(restored.player.equippedRelics).toEqual([]);
    expect(restored.player.combatTool).toBe("wayblade");
    expect(restored.player.maxHp).toBe(20);
    expect(restored.player.maxStamina).toBe(125);
    expect(restored.player.dashCostDiscount).toBe(12);
    expect(restored.player.attackBonus).toBe(3);
    game.destroy();
  });

  it("round-trips a hammer wind-up, attuned relics and reflected bolts without retaining references", async () => {
    const game = await arena();
    game.player.relics = ["starblade", "ashstep"];
    game.equipRelic("starblade");
    game.equipRelic("ashstep");
    game.setCombatTool("gravehammer");
    game.startAttack();
    game.updatePlayer(0.1);
    game.projectiles = [{ x: 0, y: 0, vx: 100, vy: 0, r: 6, dmg: 2, life: 2, color: "gold", friendly: true }];
    const snapshot = game.saveWorld();
    game.player.equippedRelics!.pop();
    game.projectiles[0].friendly = false;
    const restored = new WorldState();
    restored.restore(snapshot);
    expect(restored.player.equippedRelics).toEqual(["starblade", "ashstep"]);
    expect(restored.player.combatTool).toBe("gravehammer");
    expect(restored.player.attackWindup).toBeCloseTo(0.12);
    expect(restored.player.swingDmg).toBe(4);
    expect(restored.projectiles[0].friendly).toBe(true);
    restored.player.equippedRelics!.pop();
    expect(snapshot.player.equippedRelics).toHaveLength(2);
    game.destroy();
  });

  it("sanitizes invalid, repeated, unowned and excess attunements", () => {
    expect(normalizeEquippedRelics(["starblade", "starblade", "unknown", "tidewell", "ashstep", "emberheart"], ["starblade", "tidewell", "ashstep", "emberheart"])).toEqual(["starblade", "tidewell", "ashstep"]);
    expect(normalizeEquippedRelics(["starblade", "ashstep"], ["ashstep"])).toEqual(["ashstep"]);
    expect(normalizeEquippedRelics("starblade", ["starblade"])).toEqual([]);
  });
});
