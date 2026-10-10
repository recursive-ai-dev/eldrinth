/** Equipment modifies actions; permanent quest and wayfire rewards remain earned. */
export type RelicId = "emberheart" | "ashstep" | "tidewell" | "starblade";
export type CombatToolId = "wayblade" | "gravehammer";
export const RELIC_SLOTS = 3;

export const RELICS = [
  { id: "emberheart", name: "Emberheart", description: "Spend 18 stamina to absorb 1 damage from a hit.", tradeoff: "Dashes cost 6 more stamina.", source: "Rest at a wayfire in the Old Lands." },
  { id: "ashstep", name: "Ashstep", description: "Dash into enemy bolts to reflect them back at their source.", tradeoff: "Dashes cost 8 more stamina.", source: "Rest at a wayfire in Cinderwild." },
  { id: "tidewell", name: "Tidewell", description: "Recover 12 more stamina each second.", tradeoff: "Walking speed is reduced by 12%.", source: "Rest at a wayfire on the Moonlit Coast." },
  { id: "starblade", name: "Starblade", description: "Every strike deals 1 additional damage.", tradeoff: "Strikes take 0.14 seconds longer to recover.", source: "Rest at a wayfire in Starfall Moors." },
] as const;

export const COMBAT_TOOLS = [
  { id: "wayblade", name: "Wayblade", description: "A quick, reliable cut. No stamina cost.", damage: 1, staminaCost: 0, duration: 0.2, windup: 0, recovery: 0.16, movement: 1 },
  { id: "gravehammer", name: "Gravehammer", description: "A heavy strike after a short wind-up. Movement slows while swinging.", damage: 3, staminaCost: 18, duration: 0.44, windup: 0.22, recovery: 0.4, movement: 0.55 },
] as const;

export interface EquipmentPlayer {
  relics: string[];
  equippedRelics?: RelicId[];
  combatTool?: CombatToolId;
  attackBonus: number;
  dashCostDiscount: number;
}

export interface LoadoutStats {
  damage: number;
  dashCost: number;
  staminaRegen: number;
  movementPercent: number;
  strikeInterval: number;
}

export interface EquipmentData {
  stats?: LoadoutStats;
  tool: CombatToolId;
  tools: { id: CombatToolId; name: string; description: string; damage: number; staminaCost: number }[];
  relics: { id: RelicId; name: string; description: string; tradeoff: string; source: string; owned: boolean; equipped: boolean; preview?: LoadoutStats }[];
  slotCount: number;
  equippedCount: number;
  dashCost: number;
  staminaRegen: number;
}

export function isRelicId(value: unknown): value is RelicId {
  return RELICS.some((relic) => relic.id === value);
}

export function normalizeCombatTool(value: unknown): CombatToolId {
  return value === "gravehammer" ? value : "wayblade";
}

/** Invalid, duplicate and unowned sockets never become active when loading. */
export function normalizeEquippedRelics(value: unknown, owned: readonly string[]): RelicId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is RelicId => isRelicId(id) && owned.includes(id)))].slice(0, RELIC_SLOTS);
}

export function equippedRelics(player: EquipmentPlayer): RelicId[] {
  return normalizeEquippedRelics(player.equippedRelics, player.relics);
}

export function equipmentEffects(player: EquipmentPlayer) {
  const equipped = equippedRelics(player);
  const has = (id: RelicId) => equipped.includes(id);
  return {
    attackBonus: has("starblade") ? 1 : 0,
    attackRecovery: has("starblade") ? 0.14 : 0,
    dashCost: Math.max(10, 35 - player.dashCostDiscount) + (has("emberheart") ? 6 : 0) + (has("ashstep") ? 8 : 0),
    staminaRegen: 28 + (has("tidewell") ? 12 : 0),
    movement: has("tidewell") ? 0.88 : 1,
    reflectBolts: has("ashstep"),
    absorbHits: has("emberheart"),
  };
}

export function combatTool(player: EquipmentPlayer) {
  return COMBAT_TOOLS.find((tool) => tool.id === normalizeCombatTool(player.combatTool))!;
}

export function loadoutStats(player: EquipmentPlayer): LoadoutStats {
  const effects = equipmentEffects(player);
  const tool = combatTool(player);
  return {
    damage: tool.damage + player.attackBonus + effects.attackBonus,
    dashCost: effects.dashCost,
    staminaRegen: effects.staminaRegen,
    movementPercent: Math.round(effects.movement * 100),
    strikeInterval: Math.round((tool.duration + tool.recovery + effects.attackRecovery) * 100) / 100,
  };
}

export function previewRelic(player: EquipmentPlayer, id: RelicId): LoadoutStats | undefined {
  const equipped = equippedRelics(player);
  if (!player.relics.includes(id) || (!equipped.includes(id) && equipped.length >= RELIC_SLOTS)) return undefined;
  return loadoutStats({ ...player, equippedRelics: equipped.includes(id) ? equipped.filter(value => value !== id) : [...equipped, id] });
}

export function equipmentData(player: EquipmentPlayer): EquipmentData {
  const equipped = equippedRelics(player);
  const effects = equipmentEffects(player);
  return {
    stats: loadoutStats(player),
    tool: normalizeCombatTool(player.combatTool),
    tools: COMBAT_TOOLS.map((tool) => ({ ...tool, damage: tool.damage + player.attackBonus + effects.attackBonus })),
    relics: RELICS.map((relic) => ({ ...relic, owned: player.relics.includes(relic.id), equipped: equipped.includes(relic.id), preview: previewRelic(player, relic.id) })),
    slotCount: RELIC_SLOTS,
    equippedCount: equipped.length,
    dashCost: effects.dashCost,
    staminaRegen: effects.staminaRegen,
  };
}
