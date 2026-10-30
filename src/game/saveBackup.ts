import { WorldState, type WorldSnapshot } from "./core/WorldState";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";
import { isDifficulty } from "./types";

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const FORMAT = "eldrinth-pilgrimage";
const INVALID = "This file is not a valid ELDRINTH pilgrimage backup. Existing records have been left untouched.";
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e12;
const text = (value: unknown, max = 40000): value is string => typeof value === "string" && value.length <= max;
const array = (value: unknown, max: number): value is unknown[] => Array.isArray(value) && value.length <= max;
const strings = (value: unknown, max = 2000): boolean => array(value, max) && value.every(entry => text(entry, 240));
const numericFields = (value: RecordValue, fields: string[]) => fields.every(field => number(value[field]));
const optionalNumbers = (value: RecordValue, fields: string[]) => fields.every(field => value[field] === undefined || number(value[field]));
const dir = (value: unknown) => ["up", "down", "left", "right"].includes(String(value));
const bool = (value: unknown) => typeof value === "boolean";
const region = (value: unknown): value is string => typeof value === "string" && (
  ["overworld", "cinderwild", "moonlit-coast", "starfall-moors"].includes(value) ||
  Object.prototype.hasOwnProperty.call(FORTRESS_LAYOUTS, value) || /^interior\.(ilyarael-township|cinder-haven|oarsmans-bight|crater-watch)\.[abc]$/.test(value)
);

function fail(): never { throw new Error(INVALID); }

// Bound both work and nesting before examining imported records. Reject keys
// that could acquire special meaning when records are copied into game state.
function inspectTree(value: unknown) {
  const pending = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const entry = pending.pop()!;
    if (++count > 150000 || entry.depth > 24) fail();
    if (typeof entry.value === "number" && !number(entry.value)) fail();
    if (entry.value && typeof entry.value === "object") {
      for (const [key, child] of Object.entries(entry.value)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) fail();
        pending.push({ value: child, depth: entry.depth + 1 });
      }
    }
  }
}

function enemy(value: unknown): boolean {
  if (!object(value)) return false;
  return numericFields(value, ["id", "x", "y", "r", "hp", "maxHp", "speed", "dmg", "vx", "vy", "hurt", "t", "shootCd", "lungeCd", "lungeTimer", "lungeVx", "lungeVy", "burstCd", "summonCd", "telegraphTimer", "wanderA", "bob", "dying"]) &&
    ["wraith", "sentinel", "adept", "boss"].includes(String(value.type)) && bool(value.alive) &&
    [null, "spell", "lunge", "burst"].includes(value.telegraph as null) &&
    (value.elite === undefined || bool(value.elite));
}
function item(value: unknown): boolean {
  return object(value) && numericFields(value, ["x", "y", "t"]) && ["shard", "potion"].includes(String(value.type)) && bool(value.taken);
}
function population(value: RecordValue): boolean {
  return array(value.enemies, 3000) && value.enemies.every(enemy) && array(value.items, 3000) && value.items.every(item) &&
    (value.bossId === null || number(value.bossId)) && bool(value.bossSpawned);
}

/** Validate untrusted files separately from the permissive legacy database reader. */
function validateWorld(value: unknown): asserts value is WorldSnapshot {
  if (!object(value) || ![1, 2, 3, 4].includes(value.version as number) || !region(value.regionId) ||
      !numericFields(value, ["simulationTime", "tick", "shards", "totalShards", "messageId", "nextEnemyId", "randomState"]) ||
      !Number.isInteger(value.shards) || (value.shards as number) < 0 || (value.shards as number) > 9 || value.totalShards !== 9 ||
      !text(value.message) || !bool(value.wardUnlocked) || !population(value) ||
      (value.difficulty !== undefined && !isDifficulty(value.difficulty))) fail();
  const player = value.player;
  if (!object(player) || !numericFields(player, ["x", "y", "r", "hp", "maxHp", "stamina", "maxStamina", "staminaRegenDelay", "speed", "attackTimer", "attackCd", "attackDur", "swingDmg", "invuln", "dashTimer", "dashCd", "walkT", "hurtFlash", "kx", "ky", "dying"]) ||
      !optionalNumbers(player, ["dashCostDiscount", "attackBonus", "attackWindup", "guardTimer", "guardCooldown", "riposteTimer", "parryCount"]) ||
      !dir(player.dir) || !dir(player.dashDir) || !bool(player.attacking) || !bool(player.dashing) ||
      !array(player.swingHit, 3000) || !player.swingHit.every(number) ||
      (player.relics !== undefined && !strings(player.relics, 100)) ||
      (player.equippedRelics !== undefined && !strings(player.equippedRelics, 3)) ||
      (player.combatTool !== undefined && (typeof player.combatTool !== "string" || !["wayblade", "gravehammer"].includes(player.combatTool))) ||
      (player.maxHp as number) <= 0 || (player.maxStamina as number) <= 0 || (player.r as number) <= 0) fail();
  if (!array(value.projectiles, 10000) || !value.projectiles.every(projectile => object(projectile) && numericFields(projectile, ["x", "y", "vx", "vy", "r", "life", "dmg"]) && text(projectile.color, 80) && (projectile.friendly === undefined || bool(projectile.friendly)))) fail();
  if (value.journal !== undefined && (!array(value.journal, 4000) || !value.journal.every(entry => object(entry) && text(entry.id, 240) && text(entry.title, 1000) && text(entry.text) && (entry.questId === undefined || text(entry.questId, 240)) && (entry.source === undefined || text(entry.source, 1000)) && (entry.resolved === undefined || bool(entry.resolved))))) fail();
  if (value.quests !== undefined && (!object(value.quests) || !strings(value.quests.facts) || !object(value.quests.resolutions) || Object.keys(value.quests.resolutions).length > 2000 || !Object.values(value.quests.resolutions).every(entry => text(entry, 240)))) fail();
  if (value.regions !== undefined && (!object(value.regions) || Object.keys(value.regions).length > 64 || !Object.entries(value.regions).every(([key, entry]) => region(key) && object(entry) && population(entry)))) fail();
  if (value.checkpoint !== undefined && value.checkpoint !== null && (!object(value.checkpoint) || !region(value.checkpoint.regionId) || !numericFields(value.checkpoint, ["x", "y"]) || !text(value.checkpoint.name, 240))) fail();
  if (value.harvestedShards !== undefined && (!array(value.harvestedShards, 9) || value.harvestedShards.length !== value.shards || new Set(value.harvestedShards).size !== value.shards || !value.harvestedShards.every(id => typeof id === "string" && Object.prototype.hasOwnProperty.call(FORTRESS_LAYOUTS, id)))) fail();
  if (value.deaths !== undefined && (!number(value.deaths) || value.deaths < 0)) fail();
  if (value.atlasDiscoveries !== undefined && (!object(value.atlasDiscoveries) || Object.keys(value.atlasDiscoveries).length > 64 || !Object.entries(value.atlasDiscoveries).every(([key, ids]) => region(key) && strings(ids, 512)))) fail();
}

export function parseBackup(contents: string): WorldSnapshot {
  if (new TextEncoder().encode(contents).byteLength > MAX_BACKUP_BYTES) throw new Error("This backup is too large. Choose an ELDRINTH backup smaller than 5 MiB.");
  let backup: unknown;
  try { backup = JSON.parse(contents); } catch { fail(); }
  inspectTree(backup);
  if (!object(backup) || backup.format !== FORMAT || backup.version !== 1) fail();
  validateWorld(backup.world);
  // Use the same compatibility migrations as Continue. An ambiguous legacy
  // record must fail before it occupies a slot, rather than fail on next launch.
  const restored = new WorldState();
  restored.restore(backup.world);
  return restored.snapshot();
}

export function createBackup(world: WorldSnapshot): string {
  const contents = JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), world }, null, 2);
  parseBackup(contents);
  return contents;
}

export function downloadBackup(contents: string, slot: number) {
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `eldrinth-slot-${slot}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  // Keep the object URL alive until the browser has accepted the download.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
