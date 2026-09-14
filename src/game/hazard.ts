import { tileDefinition } from "./constants";

/**
 * Damage for standing on a tile this frame. Reuses the player's existing
 * invulnerability window so hazard damage cannot stack with a hit taken in
 * the same moment.
 */
export function hazardDamageAt(tile: number, invuln: number): number {
  if (invuln > 0) return 0;
  return tileDefinition(tile).harm ?? 0;
}
