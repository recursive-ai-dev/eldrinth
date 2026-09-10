/**
 * Shared enemy contact-damage calculation.
 *
 * This is intentionally shape-based rather than class-based so the legacy
 * `EnemyLike` simulation and the newer component model can use one formula.
 */
export interface ContactDamageTarget {
  x: number;
  y: number;
  r: number;
  dying: number;
  invuln: number;
  dashing: boolean;
}

export interface ContactDamageSource {
  x: number;
  y: number;
  r: number;
  dmg: number;
}

/**
 * Returns the damage dealt by physical contact, or `null` when no hit occurs.
 * The margin preserves the existing distinction between ordinary enemies and
 * the boss without duplicating the eligibility predicate.
 */
export function contactDamageFor(
  target: ContactDamageTarget,
  source: ContactDamageSource,
  margin = 2,
): number | null {
  if (target.dying > 0 || target.invuln > 0 || target.dashing) {
    return null;
  }

  const contactRadius = target.r + source.r - margin;
  if (contactRadius <= 0) {
    return null;
  }

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  return dx * dx + dy * dy < contactRadius * contactRadius ? source.dmg : null;
}
