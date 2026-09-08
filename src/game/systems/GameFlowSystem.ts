import type { HudData, DialogueData } from "../types";
import { TILE } from "../constants";

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
  map: { npc: { x: number; y: number }; signs: Array<{ x: number; y: number; text: string }> };
  items: Array<{ type: string; taken: boolean; x: number; y: number }>;
}

export class GameFlowSystem {
  currentObjective(state: GameFlowState): string {
    if (state.shards < state.totalShards) return `Recover the Anima Shards  (${state.shards}/${state.totalShards})`;
    if (!state.wardUnlocked) return "The ward weakens...";
    if (!state.bossSpawned) return "Enter the Glass Spire";
    if (state.boss && state.boss.alive) return "Slay the Unbound";
    return "The Spire falls silent...";
  }

  buildHud(state: GameFlowState): HudData {
    return {
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
    const p = state.player;
    const npc = state.map.npc;
    if (Math.hypot(p.x - npc.x, p.y - npc.y) < 48) {
      return "Press E to speak with Orithel";
    }
    for (const s of state.map.signs) {
      const sx = s.x * TILE + TILE / 2;
      const sy = s.y * TILE + TILE / 2;
      if (Math.hypot(p.x - sx, p.y - sy) < 44) {
        return "Press E to read";
      }
    }
    return "";
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
