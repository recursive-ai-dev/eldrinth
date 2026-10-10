/** Meter values are bounded even during a transition or an incomplete snapshot. */
export function resourceMeter(value: number, maximum: number) {
  const max = Number.isFinite(maximum) ? Math.max(0, maximum) : 0;
  const current = Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
  return { value: current, maximum: max, display: Math.ceil(current), percent: max > 0 ? Math.round(current / max * 100) : 0 };
}
