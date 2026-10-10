import { TILE, T } from "./constants";
import type { EnemyState, WorldState } from "./core/WorldState";
import type { EnemyType, SignData } from "./types";

export interface ExpeditionSite {
  id: string;
  regionId: string;
  name: string;
  kind: "refuge" | "crossing" | "arena" | "vigil";
  /** The landmark's centre, in tiles. */
  x: number;
  y: number;
  record: string;
  reward: string;
  route: SignData;
}

export const EXPEDITION_SITES: readonly ExpeditionSite[] = [
  {
    id: "uncounted-hollow", regionId: "overworld", name: "Hollow of the Uncounted", kind: "refuge", x: 34, y: 64,
    record: "A roof of living branches, an empty cradle, and a rain cistern still working. The intake map calls this wood uninhabited. Someone kept a household here for forty years after the census erased it. A scrap under the bowl says: drink, then leave the cup for the next person. No name is required. The eastern gap leads back north to the forest road.",
    reward: "The cistern's mineral water strengthens the pilgrim. Maximum health +1.",
    route: { x: 42, y: 43, title: "A Cup Left Out", text: "South of this forest road, follow the thin track beside the trees. Where two trunks lean together, turn west into the hollow. Someone still leaves a cup beneath the branches. It is not on the intake map." },
  },
  {
    id: "ashglass-causeway", regionId: "cinderwild", name: "Ashglass Causeway", kind: "crossing", x: 118, y: 50,
    record: "A narrow causeway lies between banks of fused slag. The stone rests between three seams of living ember; cross one seam at a time, and let your breath return on the pale slabs. Beyond them stands the workers' water drum. The names scratched into it never appear in the shrine's payroll. Return west along the causeway to the northeast shrine road.",
    reward: "The workers' breathing exercise survives on the water drum. Maximum stamina +12.",
    route: { x: 95, y: 45, title: "Kiln Workers' Shortcut", text: "Before the northeast shrine road reaches the scorched ravine, a narrow spur bends east. Follow it to the twin slag stacks and the Ashglass Causeway. Stone islands break the ember seams. The water drum on the far bank holds a lesson worth the crossing." },
  },
  {
    id: "drowned-court", regionId: "moonlit-coast", name: "The Drowned Court", kind: "arena", x: 54, y: 47,
    record: "The sunken court still convenes: one bailiff, two clerks, nobody left to hear. Break their shells and return to the brass docket in the centre. Its roll records appeals refused because the applicants had already been declared absent. The causeway south rejoins the road between the pale circle and the salt graves.",
    reward: "The bailiff's training plate teaches where a shell gives way. Permanent strike damage +1.",
    route: { x: 66, y: 64, title: "An Appeal Was Filed", text: "On the salt-graves road southwest of the pale circle, follow the northward spur beside this marker. A narrow causeway crosses to a court ringed by black water. The brass docket stands between the bailiff and its two clerks. They have never adjourned." },
  },
  {
    id: "listening-ring", regionId: "starfall-moors", name: "The Listening Ring", kind: "vigil", x: 109, y: 99,
    record: "Five listening stones surround a suspended bell. Its pulses measure eight breaths. Stay within the pale inner circle for eight seconds, evade the falling light, and do not strike or take a hit; either breaks the listening, even if a relic absorbs the damage. The bell's subject was required to remain attentive through every trial. Nobody wrote down whether she agreed. Follow the northward gravel spur back toward the eastern road.",
    reward: "The bell falls quiet. Its final rhythm teaches a lighter step. Dashes cost 2 less stamina.",
    route: { x: 108, y: 63, title: "A Bell Without Wind", text: "South of the eastern road, beyond Crater Watch's roofs, a gravel spur bends around the southern impact crater. Follow it to five tall listening stones. Within their pale circle, weather the bell's eight breaths without striking or being struck. You may move. You may leave." },
  },
];

export function expeditionForRegion(regionId: string): ExpeditionSite | undefined {
  return EXPEDITION_SITES.find((site) => site.regionId === regionId);
}

/** The map owns the silhouette; there are no map pins or waypoint overlays. */
export function stampExpeditionSite(regionId: string, tiles: Uint8Array, width: number, signs: SignData[]): void {
  const site = expeditionForRegion(regionId);
  if (!site) return;
  const put = (x: number, y: number, tile: number) => {
    if (x >= 0 && y >= 0 && x < width && y * width + x < tiles.length) tiles[y * width + x] = tile;
  };
  const path = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / Math.max(1, steps));
      const y = Math.round(y0 + (y1 - y0) * i / Math.max(1, steps));
      put(x, y, T.PATH);
      // Enough width for the player's circle, even where the track turns.
      put(x + 1, y, T.PATH);
    }
  };
  if (site.kind === "refuge") {
    path(42, 42, 42, 64);
    for (let y = 58; y <= 70; y++) for (let x = 27; x <= 41; x++) {
      put(x, y, x === 27 || x === 41 || y === 58 || y === 70 ? T.TREE : T.DGRASS);
    }
    path(39, 64, 43, 64);
    for (const [dx, dy] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) put(site.x + dx, site.y + dy, T.FLOWER);
    put(site.x, site.y - 2, T.WATER);
  } else if (site.kind === "crossing") {
    path(94, 47, 99, 50);
    path(99, 50, 104, 50);
    for (let y = 44; y <= 56; y++) for (let x = 104; x <= 124; x++) put(x, y, T.ROCK);
    for (let x = 104; x <= 118; x++) {
      for (let y = 49; y <= 51; y++) put(x, y, [107, 108, 112, 113, 116].includes(x) ? T.EMBERS : T.RFLOOR);
    }
    for (let y = 47; y <= 53; y++) for (let x = 118; x <= 122; x++) put(x, y, T.SPIREFLOOR);
  } else if (site.kind === "arena") {
    path(66, 64, 54, 60);
    path(54, 60, 54, 54);
    for (let y = site.y - 9; y <= site.y + 9; y++) for (let x = site.x - 9; x <= site.x + 9; x++) {
      const radius = Math.hypot(x - site.x, y - site.y);
      if (radius < 9) put(x, y, radius > 6.8 ? T.WATER : T.SAND);
    }
    for (let y = 53; y <= 57; y++) for (let x = 53; x <= 55; x++) put(x, y, T.BRIDGE);
    for (const dx of [-3, 3]) put(site.x + dx, site.y, T.RWALL);
  } else {
    path(110, 61, 115, 72);
    path(115, 72, 116, 95);
    path(116, 95, 109, 99);
    for (let y = site.y - 7; y <= site.y + 7; y++) for (let x = site.x - 7; x <= site.x + 7; x++) {
      const radius = Math.hypot(x - site.x, y - site.y);
      if (radius < 6.5) put(x, y, radius < 3.1 ? T.SPIREFLOOR : T.SAND);
    }
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
      put(site.x + Math.round(Math.cos(angle) * 6), site.y + Math.round(Math.sin(angle) * 6), T.CRYSTAL);
    }
  }
  // Each note stands on readable ground and is deliberately separate from the
  // trigger point, so reading it cannot consume or complete an encounter.
  put(site.route.x, site.route.y, T.PATH);
  signs.push({ ...site.route }, { x: site.x, y: site.y + (site.kind === "crossing" ? 2 : 3), title: site.name, text: site.record });
}

type EnemyFactory = (type: EnemyType, x: number, y: number) => EnemyState;
interface VigilAttempt { startedAt: number; pulse: number; hp: number; deaths: number; player: WorldState["player"] }
const vigils = new WeakMap<WorldState, VigilAttempt>();
const VIGIL_COLOR = "#d3b9ff";
const prefixFor = (site: ExpeditionSite) => `expedition:${site.id}`;
const pixel = (tile: number) => tile * TILE + TILE / 2;

function announce(world: WorldState, message: string) {
  world.message = message;
  world.messageId++;
}

function complete(world: WorldState, site: ExpeditionSite) {
  const id = `${prefixFor(site)}:complete`;
  if (world.journal.some((entry) => entry.id === id)) return false;
  // The reward and receipt change in the same simulation step. The receipt is
  // saved with the stats, so deaths, revisits and restores never re-award it.
  if (site.kind === "refuge") { world.player.maxHp++; world.player.hp = Math.min(world.player.maxHp, world.player.hp + 1); }
  if (site.kind === "crossing") { world.player.maxStamina += 12; world.player.stamina = Math.min(world.player.maxStamina, world.player.stamina + 12); }
  if (site.kind === "arena") world.player.attackBonus++;
  if (site.kind === "vigil") world.player.dashCostDiscount += 2;
  world.journal.push({ id, title: site.name, text: `${site.record}\n\n${site.reward}`, source: world.map.regionName, resolved: true });
  const discovery = world.journal.find((entry) => entry.id === `${prefixFor(site)}:found`);
  if (discovery) world.journal.splice(world.journal.indexOf(discovery), 1);
  announce(world, `${site.name} — ${site.reward}`);
  return true;
}

/** Called once after combat each running simulation tick. */
export function updateEncounters(world: WorldState, makeEnemy: EnemyFactory): boolean {
  const site = expeditionForRegion(world.regionId);
  if (!site || world.player.hp <= 0 || world.player.dying > 0) {
    vigils.delete(world);
    return false;
  }
  const prefix = prefixFor(site);
  if (site.kind !== "vigil") vigils.delete(world);
  if (world.journal.some((entry) => entry.id === `${prefix}:complete`)) return false;
  const cx = pixel(site.x), cy = pixel(site.y);
  const distance = Math.hypot(world.player.x - cx, world.player.y - cy);
  if (distance > TILE * 8) { vigils.delete(world); return false; }
  let changed = false;
  if (!world.journal.some((entry) => entry.id === `${prefix}:found`)) {
    world.journal.push({ id: `${prefix}:found`, title: site.name, text: site.record, source: world.map.regionName });
    announce(world, `${site.name} discovered. The route and its account are in your journal.`);
    changed = true;
  }

  if (site.kind === "arena") {
    const guardPrefix = `${prefix}:guard:`;
    let guards = world.journal.filter((entry) => entry.id.startsWith(guardPrefix));
    if (guards.length === 0 && distance < TILE * 6.5) {
      const roles = [
        { type: "sentinel" as const, dx: 0, dy: -3, title: "The Court's Bailiff", text: "The bailiff's seal reads ORDER MAINTAINED. The courtroom has been empty for centuries. Its orders have not changed." },
        { type: "adept" as const, dx: -4, dy: -1, title: "The First Clerk", text: "APPEAL RECEIVED, says the first clerk's plate. No date, no name, no place to write a reply." },
        { type: "adept" as const, dx: 4, dy: -1, title: "The Last Clerk", text: "APPLICANT ABSENT, says the second plate. The water beneath the court is full of seals like it." },
      ];
      for (const role of roles) {
        const enemy = makeEnemy(role.type, cx + role.dx * TILE, cy + role.dy * TILE);
        world.enemies.push(enemy);
        world.journal.push({ id: `${guardPrefix}${enemy.id}`, title: role.title, text: role.text, source: site.name });
      }
      guards = world.journal.filter((entry) => entry.id.startsWith(guardPrefix));
      announce(world, "The Drowned Court convenes. Break the bailiff and both clerks, then return to the brass docket.");
      changed = true;
    }
    const living = guards.some((entry) => world.enemies.some((enemy) => enemy.id === Number(entry.id.slice(guardPrefix.length)) && enemy.alive && enemy.hp > 0));
    if (guards.length === 3 && !living && distance < TILE * 1.4) return complete(world, site);
  } else if (site.kind === "vigil") {
    let attempt = vigils.get(world);
    const broken = distance > TILE * 3 || world.player.attacking || world.player.hurtFlash > 0 || (attempt && (world.player.hp < attempt.hp || world.deaths !== attempt.deaths || world.player !== attempt.player));
    if (broken) {
      if (attempt) {
        vigils.delete(world);
        world.projectiles = world.projectiles.filter((projectile) => projectile.color !== VIGIL_COLOR);
        announce(world, "The listening breaks. Return to the pale circle; evade eight seconds without striking or being struck.");
        changed = true;
      }
      return changed;
    }
    if (!attempt) {
      // A save may contain pulses from an interrupted attempt; a resumed vigil
      // starts clean instead of layering a new pattern over those old shots.
      world.projectiles = world.projectiles.filter((projectile) => projectile.color !== VIGIL_COLOR);
      attempt = { startedAt: world.simulationTime, pulse: -1, hp: world.player.hp, deaths: world.deaths, player: world.player };
      vigils.set(world, attempt);
      announce(world, "The bell listens. Stay on the pale floor for eight seconds. Move and dash; do not strike or take a hit.");
      changed = true;
    }
    const elapsed = world.simulationTime - attempt.startedAt;
    if (elapsed >= 8) {
      vigils.delete(world);
      world.projectiles = world.projectiles.filter((projectile) => projectile.color !== VIGIL_COLOR);
      return complete(world, site);
    }
    const pulse = Math.floor(elapsed / 1.2);
    if (pulse > attempt.pulse) {
      attempt.pulse = pulse;
      for (let i = 0; i < 4; i++) {
        const angle = pulse * 0.55 + i * Math.PI / 2;
        const ux = Math.cos(angle), uy = Math.sin(angle);
        world.projectiles.push({ x: cx + ux * TILE * 4.5, y: cy + uy * TILE * 4.5, vx: -ux * 95, vy: -uy * 95, r: 5, life: 3.4, dmg: 1, color: VIGIL_COLOR });
      }
    }
  } else if (distance < TILE * 1.3) {
    return complete(world, site);
  }
  return changed;
}
