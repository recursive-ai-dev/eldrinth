import { FORTRESS_LAYOUTS } from "./fortressLayouts";

type RecordValue = Record<string, unknown>;

const object = (value: unknown): value is RecordValue =>
  !!value && typeof value === "object" && !Array.isArray(value);

const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e12;

const text = (value: unknown, max = 40000): value is string =>
  typeof value === "string" && value.length <= max;

const array = (value: unknown, max: number): value is unknown[] =>
  Array.isArray(value) && value.length <= max;

const strings = (value: unknown, max = 2000): boolean =>
  array(value, max) && value.every((entry) => text(entry, 240));

const numericFields = (value: RecordValue, fields: string[]) =>
  fields.every((field) => number(value[field]));

const optionalNumbers = (value: RecordValue, fields: string[]) =>
  fields.every((field) => value[field] === undefined || number(value[field]));

const dir = (value: unknown) =>
  ["up", "down", "left", "right"].includes(String(value));

const bool = (value: unknown) => typeof value === "boolean";

const region = (value: unknown): value is string =>
  typeof value === "string" &&
  (["overworld", "cinderwild", "moonlit-coast", "starfall-moors"].includes(value) ||
    Object.prototype.hasOwnProperty.call(FORTRESS_LAYOUTS, value) ||
    /^interior\.(ilyarael-township|cinder-haven|oarsmans-bight|crater-watch)\.[abc]$/.test(value));

function inspectTree(value: unknown): { ok: boolean; reason: string | null } {
  const pending = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const entry = pending.pop();
    if (!entry) break;
    if (++count > 150000 || entry.depth > 24) {
      return { ok: false, reason: "Record is too deep or too large to validate." };
    }
    if (typeof entry.value === "number" && !number(entry.value)) {
      return { ok: false, reason: "Record contains a non-finite number." };
    }
    if (entry.value && typeof entry.value === "object") {
      for (const [key, child] of Object.entries(entry.value)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) {
          return { ok: false, reason: "Record uses a reserved key." };
        }
        pending.push({ value: child, depth: entry.depth + 1 });
      }
    }
  }
  return { ok: true, reason: null };
}

function enemy(value: unknown): { ok: boolean } {
  if (!object(value)) return { ok: false };
  const fields = [
    "id", "x", "y", "r", "hp", "maxHp", "speed", "dmg", "vx", "vy", "hurt", "t",
    "shootCd", "lungeCd", "lungeTimer", "lungeVx", "lungeVy", "burstCd", "summonCd",
    "telegraphTimer", "wanderA", "bob", "dying",
  ];
  if (!numericFields(value, fields)) return { ok: false };
  if (!["wraith", "sentinel", "adept", "boss"].includes(String(value.type))) return { ok: false };
  if (!bool(value.alive)) return { ok: false };
  if (value.telegraph !== null && !["spell", "lunge", "burst"].includes(value.telegraph as string))
    return { ok: false };
  if (value.elite !== undefined && !bool(value.elite)) return { ok: false };
  return { ok: true };
}

function item(value: unknown): { ok: boolean } {
  if (!object(value)) return { ok: false };
  if (!numericFields(value, ["x", "y", "t"])) return { ok: false };
  if (!["shard", "potion"].includes(String(value.type))) return { ok: false };
  if (!bool(value.taken)) return { ok: false };
  return { ok: true };
}

function population(value: RecordValue): { ok: boolean } {
  if (!array(value.enemies, 3000) || !value.enemies.every((e) => enemy(e).ok)) return { ok: false };
  if (!array(value.items, 3000) || !value.items.every((it) => item(it).ok)) return { ok: false };
  if (value.bossId !== null && !number(value.bossId)) return { ok: false };
  if (!bool(value.bossSpawned)) return { ok: false };
  return { ok: true };
}

export interface ValidationResult {
  valid: boolean;
  reason: string | null;
}

/**
 * Non-throwing structural validation of a world snapshot. Used by the save
 * store before accepting a database record, so a corrupt save is reported as
 * unreadable instead of crashing the engine and stranding the run.
 */
export function validateWorldSnapshot(value: unknown): ValidationResult {
  if (!object(value)) return { valid: false, reason: "Save record is not a world object." };
  if (![1, 2, 3, 4].includes(value.version as number))
    return { valid: false, reason: "Unsupported world snapshot version." };
  if (!region(value.regionId))
    return { valid: false, reason: "Save record names an unknown region." };
  if (!numericFields(value, ["simulationTime", "tick", "shards", "totalShards", "messageId", "nextEnemyId", "randomState"]))
    return { valid: false, reason: "Save record has invalid numeric simulation fields." };
  const shards = value.shards as number;
  if (!Number.isInteger(shards) || shards < 0 || shards > 9)
    return { valid: false, reason: "Save record has an invalid shard count." };
  if (value.totalShards !== 9) return { valid: false, reason: "Save record expects nine shards." };
  if (!text(value.message)) return { valid: false, reason: "Save record has an invalid message." };
  if (!bool(value.wardUnlocked)) return { valid: false, reason: "Save record has an invalid ward state." };
  const pop = population(value);
  if (!pop.ok) return { valid: false, reason: "Save record has an invalid enemy/item population." };
  // difficulty is gracefully normalized by normalizeDifficulty() on load, so an
  // unrecognized string here is tolerated rather than treated as corruption.
  const player = value.player;
  if (!object(player))
    return { valid: false, reason: "Save record is missing player state." };
  const playerFields = [
    "x", "y", "r", "hp", "maxHp", "stamina", "maxStamina", "staminaRegenDelay",
    "speed", "attackTimer", "attackCd", "attackDur", "swingDmg", "invuln",
    "dashTimer", "dashCd", "walkT", "hurtFlash", "kx", "ky", "dying",
  ];
  if (!numericFields(player, playerFields))
    return { valid: false, reason: "Player state has invalid numeric fields." };
  const { maxHp, maxStamina, r } = player as { maxHp: number; maxStamina: number; r: number };
  if (!optionalNumbers(player, ["dashCostDiscount", "attackBonus", "attackWindup", "guardTimer", "guardCooldown", "riposteTimer", "parryCount"]))
    return { valid: false, reason: "Player state has invalid optional numeric fields." };
  if (!dir(player.dir) || !dir(player.dashDir))
    return { valid: false, reason: "Player state has an invalid direction." };
  if (!bool(player.attacking) || !bool(player.dashing))
    return { valid: false, reason: "Player state has invalid action flags." };
  if (!array(player.swingHit, 3000) || !player.swingHit.every(number))
    return { valid: false, reason: "Player state has an invalid swing-hit record." };
  if (player.relics !== undefined && !strings(player.relics, 100))
    return { valid: false, reason: "Player state has invalid relics." };
  if (player.equippedRelics !== undefined && !strings(player.equippedRelics, 3))
    return { valid: false, reason: "Player state has invalid equipped relics." };
  const combatTool = player.combatTool;
  if (combatTool !== undefined && (typeof combatTool !== "string" || !["wayblade", "gravehammer"].includes(combatTool)))
    return { valid: false, reason: "Player state has an invalid combat tool." };
  if (maxHp <= 0 || maxStamina <= 0 || r <= 0)
    return { valid: false, reason: "Player state has non-positive size or health." };

  if (!array(value.projectiles, 10000) ||
      !value.projectiles.every((pr) => object(pr) && numericFields(pr, ["x", "y", "vx", "vy", "r", "life", "dmg"]) && text(pr.color, 80) && (pr.friendly === undefined || bool(pr.friendly))))
    return { valid: false, reason: "Save record has invalid projectiles." };

  if (value.journal !== undefined) {
    if (!array(value.journal, 4000) ||
        !value.journal.every((entry) =>
          object(entry) && text(entry.id, 240) && text(entry.title, 1000) && text(entry.text) &&
          (entry.questId === undefined || text(entry.questId, 240)) &&
          (entry.source === undefined || text(entry.source, 1000)) &&
          (entry.resolved === undefined || bool(entry.resolved))))
      return { valid: false, reason: "Save record has an invalid journal." };
  }

  if (value.quests !== undefined) {
    if (!object(value.quests) || !strings(value.quests.facts) || !object(value.quests.resolutions) ||
        Object.keys(value.quests.resolutions).length > 2000 ||
        !Object.values(value.quests.resolutions).every((entry) => text(entry, 240)))
      return { valid: false, reason: "Save record has invalid quests." };
  }

  if (value.regions !== undefined) {
    if (!object(value.regions) || Object.keys(value.regions).length > 64 ||
        !Object.entries(value.regions).every(([key, entry]) =>
          region(key) && object(entry) && population(entry).ok))
      return { valid: false, reason: "Save record has invalid region snapshots." };
  }

  if (value.checkpoint !== undefined && value.checkpoint !== null) {
    if (!object(value.checkpoint) || !region(value.checkpoint.regionId) ||
        !numericFields(value.checkpoint, ["x", "y"]) || !text(value.checkpoint.name, 240))
      return { valid: false, reason: "Save record has an invalid checkpoint." };
  }

  if (value.harvestedShards !== undefined) {
    if (!array(value.harvestedShards, 9) ||
        value.harvestedShards.length !== shards ||
        new Set(value.harvestedShards).size !== shards ||
        !value.harvestedShards.every((id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(FORTRESS_LAYOUTS, id)))
      return { valid: false, reason: "Save record has harvested shards that do not match its shard count." };
  }

  if (value.deaths !== undefined && (!number(value.deaths) || value.deaths < 0))
    return { valid: false, reason: "Save record has an invalid death count." };

  if (value.atlasDiscoveries !== undefined) {
    if (!object(value.atlasDiscoveries) || Object.keys(value.atlasDiscoveries).length > 64 ||
        !Object.entries(value.atlasDiscoveries).every(([key, ids]) =>
          region(key) && strings(ids, 512)))
      return { valid: false, reason: "Save record has invalid atlas discoveries." };
  }

  const tree = inspectTree(value);
  if (!tree.ok) return { valid: false, reason: tree.reason };

  return { valid: true, reason: null };
}
