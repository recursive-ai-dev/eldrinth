import type { HudData, DialogueData } from "../types";
import { interactionPrompt, selectInteraction } from "../interactions";

export interface GameFlowState {
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    stamina: number;
    maxStamina: number;
    r: number;
  };
  enemies: Array<{ alive: boolean; type: string; hp: number; maxHp: number; x: number; y: number; r: number }>;
  boss: { alive: boolean; hp: number; maxHp: number } | null;
  shards: number;
  totalShards: number;
  wardUnlocked: boolean;
  bossSpawned: boolean;
  message: string;
  messageId: number;
  prompt: string;
  dialogue: DialogueData | null;
  map: {
    regionName: string;
    npc: { x: number; y: number };
    npcs: Array<{ x: number; y: number; name: string; role: string }>;
    towns: Array<{ x: number; y: number }>;
    exits: Array<{ x: number; y: number; label: string; requiresInteraction?: boolean }>;
    signs: Array<{ x: number; y: number; text: string }>;
    campfires: Array<{ x: number; y: number }>;
  };
  items: Array<{ type: string; taken: boolean; x: number; y: number }>;
}

export class GameFlowSystem {
  currentObjective(state: GameFlowState): string {
    if (state.shards < state.totalShards) {
      return "Read the roads. Record what was taken.";
    }
    if (!state.wardUnlocked) return "Something in the east stops pretending";
    if (!state.bossSpawned) return "The ward is open. Orithel is waiting at the Spire.";
    if (state.boss && state.boss.alive) return "Nine hundred years are awake and screaming";
    return "The Spire falls silent";
  }

  buildHud(state: GameFlowState): HudData {
    return {
      regionName: state.map.regionName,
      hp: Math.max(0, Math.ceil(state.player.hp)),
      maxHp: state.player.maxHp,
      stamina: Math.max(0, state.player.stamina),
      maxStamina: state.player.maxStamina,
      shards: state.shards,
      totalShards: state.totalShards,
      objective: this.currentObjective(state),
      message: state.message,
      messageId: state.messageId,
      prompt: state.prompt,
      enemies: state.enemies.filter((e) => e.alive && e.type !== "boss").length,
      bossActive: !!(state.boss && state.boss.alive),
      bossHp: state.boss && state.boss.alive && state.boss.maxHp > 0 ? Math.max(0, state.boss.hp / state.boss.maxHp) : 0,
    };
  }

  updatePrompt(state: GameFlowState): string {
    if (state.dialogue) return state.prompt;
    return interactionPrompt(selectInteraction(state));
  }

  advanceDialogue(dialogue: DialogueData | null, lines: string[], index: number) {
    if (!dialogue) return null;
    const nextIndex = index + 1;
    if (nextIndex >= lines.length) return null;
    return {
      ...dialogue,
      index: nextIndex,
      text: lines[nextIndex],
    };
  }
}
