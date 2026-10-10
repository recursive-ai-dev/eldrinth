import { SIGN_READ_RADIUS, TILE } from "./constants";
import type { Vec } from "./types";
import { SHARD_INTERACT_RADIUS } from "./voices";

interface InteractionItem extends Vec { type: string; taken: boolean }
interface InteractionDoor extends Vec { label: string; requiresInteraction?: boolean }
interface InteractionNpc extends Vec { name: string }
interface InteractionSign extends Vec { text: string }

export interface InteractionState<
  Item extends InteractionItem = InteractionItem,
  Door extends InteractionDoor = InteractionDoor,
  Npc extends InteractionNpc = InteractionNpc,
  Fire extends Vec = Vec,
  Sign extends InteractionSign = InteractionSign,
> {
  player: Vec;
  items: readonly Item[];
  map: {
    npc: Vec;
    npcs: readonly Npc[];
    exits: readonly Door[];
    signs: readonly Sign[];
    campfires: readonly Fire[];
  };
}

export type InteractionTarget<
  Item extends InteractionItem = InteractionItem,
  Door extends InteractionDoor = InteractionDoor,
  Npc extends InteractionNpc = InteractionNpc,
  Fire extends Vec = Vec,
  Sign extends InteractionSign = InteractionSign,
> =
  | { kind: "shard"; target: Item }
  | { kind: "doorway"; target: Door }
  | { kind: "npc"; target: Npc }
  | { kind: "fire"; target: Fire }
  | { kind: "watcher"; target: Vec }
  | { kind: "sign"; target: Sign };

function tileCentre(point: Vec): Vec {
  return { x: point.x * TILE + TILE / 2, y: point.y * TILE + TILE / 2 };
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearest<T extends Vec>(
  player: Vec,
  targets: readonly T[],
  radius: number,
  position: (target: T) => Vec = (target) => target,
  eligible: (target: T) => boolean = () => true,
): T | null {
  let winner: T | null = null;
  let shortest = radius;
  for (const target of targets) {
    if (!eligible(target)) continue;
    const separation = distance(player, position(target));
    // Preserve authored array order for exact ties and strict radius bounds.
    if (separation >= shortest) continue;
    winner = target;
    shortest = separation;
  }
  return winner;
}

/**
 * The HUD and E action must resolve the same thing. Shards take precedence;
 * inhabitants and interactive doors compete by distance, with doors winning
 * exact ties. Wayfires, Orithel, then field signs retain their existing order.
 * The selected target keeps its concrete type for the engine's action handler.
 */
export function selectInteraction<
  Item extends InteractionItem,
  Door extends InteractionDoor,
  Npc extends InteractionNpc,
  Fire extends Vec,
  Sign extends InteractionSign,
>(state: InteractionState<Item, Door, Npc, Fire, Sign>): InteractionTarget<Item, Door, Npc, Fire, Sign> | null {
  const { player, map } = state;
  const shard = nearest(player, state.items, SHARD_INTERACT_RADIUS, undefined, (item) => item.type === "shard" && !item.taken);
  if (shard) return { kind: "shard", target: shard };

  const doorway = nearest(player, map.exits, SIGN_READ_RADIUS, tileCentre, (exit) => Boolean(exit.requiresInteraction));
  const npc = nearest(player, map.npcs, 48);
  if (npc && (!doorway || distance(player, npc) < distance(player, tileCentre(doorway)))) {
    return { kind: "npc", target: npc };
  }
  if (doorway) return { kind: "doorway", target: doorway };

  const fire = nearest(player, map.campfires, 52);
  if (fire) return { kind: "fire", target: fire };
  if (distance(player, map.npc) < 48) return { kind: "watcher", target: map.npc };

  const sign = nearest(player, map.signs, SIGN_READ_RADIUS, tileCentre);
  return sign ? { kind: "sign", target: sign } : null;
}

export function interactionPrompt(interaction: InteractionTarget | null): string {
  if (!interaction) return "";
  switch (interaction.kind) {
    case "shard": return "Press E to hear the person inside";
    case "npc": return `Press E to speak with ${interaction.target.name}`;
    case "doorway": return `Press E to enter ${interaction.target.label}`;
    case "fire": return "Press E to rest and listen at the wayfire";
    case "watcher": return "Press E to speak with Orithel";
    case "sign": return "Press E to read note";
  }
}
