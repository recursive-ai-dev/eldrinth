import { beforeAll, describe, expect, it, vi } from "vitest";
import { TILE, tileDefinition } from "./constants";
import { WorldState, type EnemyState } from "./core/WorldState";
import { EXPEDITION_SITES, updateEncounters, type ExpeditionSite } from "./encounters";
import { Game } from "./engine";
import { installHeadlessDom, makeHeadlessCanvas, silentCallbacks } from "./headlessGame";
import { generateMap } from "./map";
import { expeditionOnMap } from "./render/expeditionLandmarks";
import { renderGame } from "./render/renderer";
import type { EnemyType, MapData } from "./types";

const pixel = (tile: number) => tile * TILE + TILE / 2;

function worldAt(site: ExpeditionSite): WorldState {
  const world = new WorldState();
  world.regionId = site.regionId;
  world.map = generateMap(site.regionId);
  world.player = {
    x: pixel(site.x), y: pixel(site.y), r: 12, hp: 12, maxHp: 12, stamina: 100, maxStamina: 100,
    staminaRegenDelay: 0, dir: "down", speed: 140, attackTimer: 0, attackCd: 0, attackDur: 0.2,
    attacking: false, swingHit: new Set(), swingDmg: 1, invuln: 0, dashTimer: 0, dashCd: 0,
    dashDir: "down", dashing: false, walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0,
    relics: [], dashCostDiscount: 0, attackBonus: 0,
  };
  return world;
}

function factory(world: WorldState) {
  return vi.fn((type: EnemyType, x: number, y: number): EnemyState => ({
    id: world.nextEnemyId++, type, x, y, r: 12, hp: 4, maxHp: 4, speed: 60, dmg: 1,
    vx: 0, vy: 0, hurt: 0, t: 0, shootCd: 1, lungeCd: 0, lungeTimer: 0, lungeVx: 0, lungeVy: 0,
    burstCd: 2.4, summonCd: 8, telegraph: null, telegraphTimer: 0, wanderA: 0, bob: 0, alive: true, dying: 0,
  }));
}

function restored(world: WorldState) {
  const loaded = new WorldState();
  loaded.restore(JSON.parse(JSON.stringify(world.snapshot())));
  loaded.map = generateMap(loaded.regionId);
  return loaded;
}

function reachable(map: MapData, x: number, y: number, avoidHazards = false): boolean {
  const start = Math.floor(map.spawn.y / TILE) * map.width + Math.floor(map.spawn.x / TILE);
  const seen = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const tile = queue[i];
    if (tile === y * map.width + x) return true;
    const tx = tile % map.width, ty = Math.floor(tile / map.width);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const index = ny * map.width + nx;
      const definition = tileDefinition(map.tiles[index]);
      if (seen.has(index) || definition.shape === "solid" || (avoidHazards && definition.harm)) continue;
      seen.add(index); queue.push(index);
    }
  }
  return false;
}

describe("authored expedition geography", () => {
  it.each(EXPEDITION_SITES)("gives $name a reachable silhouette, record and geographical directions", (site) => {
    const map = generateMap(site.regionId);
    expect(reachable(map, site.x, site.y)).toBe(true);
    expect(expeditionOnMap(map)?.id).toBe(site.id);
    const notes = map.signs.filter((sign) => sign.title === site.name || sign.title === site.route.title);
    expect(notes).toHaveLength(2);
    for (const note of notes) {
      expect(reachable(map, note.x, note.y), note.title).toBe(true);
      expect(tileDefinition(map.tiles[note.y * map.width + note.x]).shape).not.toBe("solid");
    }
    expect(site.route.text).toMatch(/north|south|east|west/i);
    expect(site.route.text).not.toMatch(/\d+,\s*\d+/);
  });

  it("requires crossing ember seams to reach the causeway's far bank", () => {
    const site = EXPEDITION_SITES.find((entry) => entry.kind === "crossing")!;
    const map = generateMap(site.regionId);
    expect(reachable(map, site.x, site.y, true)).toBe(false);
    expect(reachable(map, site.x, site.y)).toBe(true);
  });
});

describe("permanent expedition rewards", () => {
  it.each(EXPEDITION_SITES.filter((site) => site.kind === "refuge" || site.kind === "crossing"))("grants $name once across death and JSON restore", (site) => {
    const world = worldAt(site);
    const makeEnemy = factory(world);
    world.player.dying = 1;
    expect(updateEncounters(world, makeEnemy)).toBe(false);
    world.player.dying = 0;
    expect(updateEncounters(world, makeEnemy)).toBe(true);
    expect(updateEncounters(world, makeEnemy)).toBe(false);
    const maxHp = world.player.maxHp, maxStamina = world.player.maxStamina;
    expect(maxHp).toBe(site.kind === "refuge" ? 13 : 12);
    expect(maxStamina).toBe(site.kind === "crossing" ? 112 : 100);
    world.deaths++;
    const loaded = restored(world);
    expect(updateEncounters(loaded, factory(loaded))).toBe(false);
    expect(loaded.player.maxHp).toBe(maxHp);
    expect(loaded.player.maxStamina).toBe(maxStamina);
    expect(loaded.journal.filter((entry) => entry.id.endsWith(":complete"))).toHaveLength(1);
  });

  it("seeds the court in an existing save, follows its exact enemies and never repeats the reward", () => {
    const site = EXPEDITION_SITES.find((entry) => entry.kind === "arena")!;
    const world = restored(worldAt(site)); // Existing v4 save, no expedition data.
    const makeEnemy = factory(world);
    expect(updateEncounters(world, makeEnemy)).toBe(true);
    expect(makeEnemy).toHaveBeenCalledTimes(3);
    expect(world.player.attackBonus).toBe(0);
    expect(world.enemies.map((enemy) => enemy.type)).toEqual(["sentinel", "adept", "adept"]);
    // Walking the cast away from its original positions must not count as a kill.
    for (const enemy of world.enemies) enemy.x += TILE * 30;
    expect(updateEncounters(world, makeEnemy)).toBe(false);
    expect(world.player.attackBonus).toBe(0);
    world.enemies[0].alive = false;
    world.enemies[0].hp = 0;
    world.enemies.splice(0, 1);
    const loaded = restored(world);
    const resumeFactory = factory(loaded);
    updateEncounters(loaded, resumeFactory);
    expect(resumeFactory).not.toHaveBeenCalled();
    expect(loaded.player.attackBonus).toBe(0);
    // A real death leaves outdoor inhabitants retained; it cannot bypass the cast.
    loaded.deaths++;
    updateEncounters(loaded, resumeFactory);
    expect(loaded.player.attackBonus).toBe(0);
    for (const enemy of loaded.enemies) { enemy.alive = false; enemy.hp = 0; }
    expect(updateEncounters(loaded, resumeFactory)).toBe(true);
    expect(loaded.player.attackBonus).toBe(1);
    const completed = restored(loaded);
    expect(updateEncounters(completed, factory(completed))).toBe(false);
    expect(completed.player.attackBonus).toBe(1);
  });

  it("makes the bell's eight-second vigil fail on strikes, wounds or leaving, and restart after loading", () => {
    const site = EXPEDITION_SITES.find((entry) => entry.kind === "vigil")!;
    const world = worldAt(site);
    const makeEnemy = factory(world);
    expect(updateEncounters(world, makeEnemy)).toBe(true);
    expect(world.projectiles).toHaveLength(4);
    world.simulationTime = 5;
    world.player.attacking = true;
    updateEncounters(world, makeEnemy);
    expect(world.projectiles).toHaveLength(0);
    world.player.attacking = false;
    updateEncounters(world, makeEnemy);
    world.simulationTime = 10;
    world.player.hp--;
    updateEncounters(world, makeEnemy);
    expect(world.player.dashCostDiscount).toBe(0);
    updateEncounters(world, makeEnemy);
    world.simulationTime = 15;
    world.player.x += TILE * 4;
    updateEncounters(world, makeEnemy);
    world.player.x -= TILE * 4;
    updateEncounters(world, makeEnemy);
    world.simulationTime = 22;
    updateEncounters(world, makeEnemy);
    const loaded = restored(world);
    const loadedFactory = factory(loaded);
    loaded.simulationTime = 50;
    updateEncounters(loaded, loadedFactory);
    expect(loaded.player.dashCostDiscount).toBe(0);
    expect(loaded.projectiles).toHaveLength(4);
    loaded.simulationTime = 57.99;
    updateEncounters(loaded, loadedFactory);
    expect(loaded.player.dashCostDiscount).toBe(0);
    loaded.simulationTime = 58;
    updateEncounters(loaded, loadedFactory);
    expect(loaded.player.dashCostDiscount).toBe(2);
    expect(loaded.projectiles).toHaveLength(0);
    const completed = restored(loaded);
    expect(updateEncounters(completed, factory(completed))).toBe(false);
    expect(completed.player.dashCostDiscount).toBe(2);
  });
});

describe("engine expedition integration", () => {
  beforeAll(installHeadlessDom);

  it("discovers, renders and saves a boon through a real simulation tick", async () => {
    const game = new Game(makeHeadlessCanvas(), silentCallbacks());
    await game.init();
    const site = EXPEDITION_SITES[0];
    game.player.x = pixel(site.x);
    game.player.y = pixel(site.y);
    const maxHp = game.player.maxHp;
    game.simulateStep(1 / 60);
    expect(game.player.maxHp).toBe(maxHp + 1);
    expect(game.saveWorld().journal?.some((entry) => entry.id === `expedition:${site.id}:complete`)).toBe(true);
    expect(() => renderGame(game)).not.toThrow();
    game.destroy();
  });

  it("moves an old saved position out of newly authored solid terrain", async () => {
    const game = new Game(makeHeadlessCanvas(), silentCallbacks());
    game.world.regionId = "cinderwild";
    await game.init();
    const saved = game.saveWorld();
    // Open ground in v1, now the western slag bank of the causeway.
    saved.player.x = pixel(104);
    saved.player.y = pixel(44);
    saved.enemies[0].x = pixel(105);
    saved.enemies[0].y = pixel(44);
    expect(game.hitsSolid(saved.player.x, saved.player.y, saved.player.r)).toBe(true);
    game.loadWorld(saved);
    expect(game.hitsSolid(game.player.x, game.player.y, game.player.r)).toBe(false);
    expect(game.hitsSolid(game.enemies[0].x, game.enemies[0].y, game.enemies[0].r)).toBe(false);
    expect(game.player.maxHp).toBe(saved.player.maxHp);
    expect(game.world.journal).toEqual(saved.journal);
    game.destroy();
  });

  it("retains the court's surviving cast through an actual wayfire respawn", async () => {
    const game = new Game(makeHeadlessCanvas(), silentCallbacks());
    game.world.regionId = "moonlit-coast";
    await game.init();
    const site = EXPEDITION_SITES.find((entry) => entry.kind === "arena")!;
    const arrive = () => { game.player.x = pixel(site.x); game.player.y = pixel(site.y); };
    arrive();
    game.simulateStep(1 / 60);
    const guardIds = game.world.journal.filter((entry) => entry.id.startsWith(`expedition:${site.id}:guard:`)).map((entry) => Number(entry.id.split(":").at(-1)));
    expect(guardIds).toHaveLength(3);
    game.killEnemy(game.enemies.find((enemy) => enemy.id === guardIds[0])!);
    game.player.dying = 0.001;
    game.simulateStep(1 / 60);
    expect(game.world.deaths).toBe(1);
    expect(game.enemies.filter((enemy) => guardIds.includes(enemy.id) && enemy.alive)).toHaveLength(2);
    arrive();
    game.simulateStep(1 / 60);
    expect(game.player.attackBonus).toBe(0);
    expect(game.world.journal.filter((entry) => entry.id.includes(":guard:"))).toHaveLength(3);
    for (const enemy of game.enemies) if (guardIds.includes(enemy.id) && enemy.alive) game.killEnemy(enemy);
    game.simulateStep(1 / 60);
    expect(game.player.attackBonus).toBe(1);
    const saved = game.saveWorld();
    game.loadWorld(saved);
    game.simulateStep(1 / 60);
    expect(game.player.attackBonus).toBe(1);
    game.destroy();
  });
});
