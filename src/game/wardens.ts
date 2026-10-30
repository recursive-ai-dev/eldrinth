/** Regional warden rules shared by simulation, warnings and the field guide.
 * Wardens reuse checkpointed spell/lunge timers, so older pilgrimages acquire
 * the new moves without a save migration or any additional enemies. */
export const WARDEN_STYLES = {
  "old-lands": {
    name: "Old Lands · Oathbound warden", label: "CHARGE", pattern: "charge",
    region: "The Old Lands", telegraph: "lunge", windup: 0.85, cooldown: 3.8,
    color: "#ffb875", speed: 270,
    summary: "A straight charge committed to the direction shown by its warning lane.",
    tactic: "Move sideways during the wind-up. The warden cannot turn during its charge and rests briefly afterward; use that opening to strike.",
  },
  cinderwild: {
    name: "Cinderwild · Kiln warden", label: "EMBER RING", pattern: "ring",
    region: "Cinderwild", telegraph: "burst", windup: 1.0, cooldown: 4.2,
    color: "#ff995b", speed: 120,
    summary: "Eight slow embers spread outward in a ring after a long warning.",
    tactic: "Watch the eight warning rays and stand between them. Keep some distance so the gaps widen, then close while the kiln cools.",
  },
  "moonlit-coast": {
    name: "Moonlit Coast · Tide warden", label: "TIDAL FAN", pattern: "fan",
    region: "Moonlit Coast", telegraph: "spell", windup: 0.9, cooldown: 3.6,
    color: "#7de4e5", speed: 155,
    summary: "Three bolts fan toward the position you held when the wind-up began.",
    tactic: "Cross beyond the outside warning lane rather than backing straight away. The warden holds its aim until the fan has left.",
  },
  "starfall-moors": {
    name: "Starfall Moors · Astral warden", label: "STAR CROSS", pattern: "cross",
    region: "Starfall Moors", telegraph: "burst", windup: 0.95, cooldown: 3.9,
    color: "#cfb1ff", speed: 175,
    summary: "An orbiting warden fires four perpendicular rays along a fixed cross.",
    tactic: "Move into a diagonal gap between the four warning lanes. The cross holds its direction through the wind-up; approach during its recovery.",
  },
} as const;

export type WardenStyle = typeof WARDEN_STYLES[keyof typeof WARDEN_STYLES];

export function wardenStyleForRegion(regionId?: string): WardenStyle | null {
  if (regionId === "overworld" || regionId?.startsWith("fortress.old-lands-")) return WARDEN_STYLES["old-lands"];
  if (regionId === "cinderwild" || regionId?.startsWith("fortress.cinderwild-")) return WARDEN_STYLES.cinderwild;
  if (regionId === "moonlit-coast" || regionId?.startsWith("fortress.moonlit-")) return WARDEN_STYLES["moonlit-coast"];
  if (regionId === "starfall-moors" || regionId?.startsWith("fortress.starfall-")) return WARDEN_STYLES["starfall-moors"];
  return null;
}

/** Exact trajectories also draw the warning: visual lanes cannot disagree with
 * the eventual projectiles. Charge uses one lane without emitting a bolt. */
export function wardenAttackDirections(style: WardenStyle, aimX: number, aimY: number): { x: number; y: number }[] {
  const angle = Math.atan2(aimY, aimX);
  const angles = style.pattern === "ring" ? Array.from({ length: 8 }, (_, i) => i * Math.PI / 4)
    : style.pattern === "fan" ? [-0.4, 0, 0.4].map(offset => angle + offset)
    : style.pattern === "cross" ? [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(offset => angle + offset)
    : [angle];
  return angles.map(a => ({ x: Math.cos(a), y: Math.sin(a) }));
}
