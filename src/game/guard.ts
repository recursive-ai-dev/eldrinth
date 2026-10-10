import { DIRV } from "./math";
import type { Dir } from "./types";

export const GUARD_WINDOW = 0.24;
export const GUARD_COOLDOWN = 0.9;
export const GUARD_COST = 18;
export const RIPOSTE_WINDOW = 2;
export const RIPOSTE_DAMAGE = 2;

/** A brief, directional commitment. Holding the key never repeats it. */
export interface GuardState {
  x: number;
  y: number;
  dir: Dir;
  stamina: number;
  maxStamina: number;
  staminaRegenDelay: number;
  invuln: number;
  dying: number;
  dashing: boolean;
  attacking: boolean;
  guardTimer?: number;
  guardCooldown?: number;
  riposteTimer?: number;
  parryCount?: number;
}

export function startGuard(player: GuardState): boolean {
  if (player.dying > 0 || player.dashing || player.attacking || (player.guardCooldown ?? 0) > 0 || player.stamina < GUARD_COST) return false;
  player.stamina -= GUARD_COST;
  player.staminaRegenDelay = Math.max(player.staminaRegenDelay, 0.6);
  player.guardTimer = GUARD_WINDOW;
  player.guardCooldown = GUARD_COOLDOWN;
  return true;
}

export function tickGuard(player: GuardState, dt: number): void {
  player.guardTimer = Math.max(0, (player.guardTimer ?? 0) - dt);
  player.guardCooldown = Math.max(0, (player.guardCooldown ?? 0) - dt);
  player.riposteTimer = Math.max(0, (player.riposteTimer ?? 0) - dt);
}

/** Only the forward 120-degree arc catches a blow. Hazards bypass this path. */
export function tryParry(player: GuardState, sourceX: number, sourceY: number): boolean {
  if ((player.guardTimer ?? 0) <= 0 || player.dying > 0 || player.dashing) return false;
  const dx = sourceX - player.x;
  const dy = sourceY - player.y;
  const distance = Math.hypot(dx, dy);
  const [forwardX, forwardY] = DIRV[player.dir];
  if (distance > 0.01 && (dx * forwardX + dy * forwardY) / distance < 0.5) return false;
  player.guardTimer = 0;
  player.riposteTimer = RIPOSTE_WINDOW;
  player.parryCount = (player.parryCount ?? 0) + 1;
  player.stamina = Math.min(player.maxStamina, player.stamina + 12);
  player.invuln = Math.max(player.invuln, 0.35);
  return true;
}

export function consumeRiposte(player: GuardState): number {
  if ((player.riposteTimer ?? 0) <= 0) return 0;
  player.riposteTimer = 0;
  return RIPOSTE_DAMAGE;
}

export function guardData(player: GuardState) {
  return { window: player.guardTimer ?? 0, cooldown: player.guardCooldown ?? 0, riposte: player.riposteTimer ?? 0, parries: player.parryCount ?? 0 };
}
