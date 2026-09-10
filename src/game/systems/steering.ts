/**
 * Shared velocity-steering behavior for actors.
 *
 * AI behaviors only calculate desired velocity. This module centralizes how
 * quickly actual velocity approaches that intent.
 */
export interface Velocity2D {
  vx: number;
  vy: number;
}

export interface DesiredVelocity2D {
  x: number;
  y: number;
}

export function steeringWeight(dt: number, responsiveness = 12): number {
  return Math.min(1, Math.max(0, dt) * responsiveness);
}

export function steerVelocity(current: number, desired: number, dt: number, responsiveness = 12): number {
  const weight = steeringWeight(dt, responsiveness);
  return current + (desired - current) * weight;
}

export function steerXY(
  velocity: Velocity2D,
  desired: DesiredVelocity2D,
  dt: number,
  responsiveness = 12,
): void {
  velocity.vx = steerVelocity(velocity.vx, desired.x, dt, responsiveness);
  velocity.vy = steerVelocity(velocity.vy, desired.y, dt, responsiveness);
}
