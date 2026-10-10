import { TILE, TILE_DEFINITIONS } from "./constants";
import type { WayfireCheckpoint } from "./core/WorldState";
import type { Dir, JournalEntry, MapData, Vec } from "./types";

export type LandmarkKind = "wayfire" | "town" | "road" | "door" | "record";
export interface Landmark extends Vec {
  id: string;
  name: string;
  kind: LandmarkKind;
  detail: string;
  recorded: boolean;
  checkpoint: boolean;
}

/** A UI projection in tile units. It never contains undiscovered map objects. */
export interface NavigationData {
  regionId: string;
  regionName: string;
  width: number;
  height: number;
  player: Vec & { dir: Dir };
  landmarks: Landmark[];
  sanctuary: string | null;
  checkpoint: { name: string; local: boolean } | null;
}

const SURVEY_RADIUS = TILE * 8;

function visible(from: Vec, to: Vec, map: MapData): boolean {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance > SURVEY_RADIUS) return false;
  const steps = Math.max(1, Math.ceil(distance / (TILE / 4)));
  // Ignore the destination tile: a sign or doorway can occupy solid scenery.
  const endX = Math.floor(to.x / TILE), endY = Math.floor(to.y / TILE);
  for (let i = 1; i < steps; i++) {
    const x = Math.floor((from.x + (to.x - from.x) * i / steps) / TILE);
    const y = Math.floor((from.y + (to.y - from.y) * i / steps) / TILE);
    if (x === endX && y === endY) continue;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    if (TILE_DEFINITIONS[map.tiles[y * map.width + x]]?.shape === "solid") return false;
  }
  return true;
}

/** Retained IDs are scoped by region and owned by the caller, never mutated here. */
export function navigationData({ regionId, map, player, journal, checkpoint, discoveredIds }: {
  regionId: string;
  map: MapData;
  player: Vec & { dir: Dir };
  journal: readonly JournalEntry[];
  checkpoint: WayfireCheckpoint | null;
  discoveredIds?: ReadonlySet<string>;
}): NavigationData {
  const journalIds = new Set(journal.map(entry => entry.id));
  const landmarks: Landmark[] = [];
  const add = (point: Vec, landmark: Omit<Landmark, "x" | "y">, known = false) => {
    if (!known && !discoveredIds?.has(landmark.id) && !visible(player, point, map)) return;
    landmarks.push({ ...landmark, x: point.x / TILE, y: point.y / TILE });
  };
  const signRead = (x: number, y: number) => journalIds.has(`${regionId}:${x}:${y}`);
  for (const fire of map.campfires) {
    const active = checkpoint?.regionId === regionId && checkpoint.x === fire.x && checkpoint.y === fire.y;
    add(fire, { id: `${regionId}:wayfire:${fire.x}:${fire.y}`, name: fire.name, kind: "wayfire", detail: active ? "Your return point · restores life and stamina" : "Rest to restore life and stamina", recorded: !!active, checkpoint: !!active }, !!active);
  }
  for (const town of map.towns) {
    const inSanctuary = Math.hypot(player.x - town.x, player.y - town.y) < town.safeRadius;
    const recorded = !!town.sign && signRead(town.sign.x, town.sign.y);
    const heard = town.npcs?.some(npc => journalIds.has(npc.id)) ?? false;
    add(town, { id: `${regionId}:town:${town.id}`, name: town.name, kind: "town", detail: "Sanctuary · enemies do not pursue inside", recorded: recorded || heard, checkpoint: false }, inSanctuary || recorded || heard);
  }
  for (const exit of map.exits) {
    const point = { x: (exit.x + .5) * TILE, y: (exit.y + .5) * TILE };
    const recorded = map.signs.some(sign => signRead(sign.x, sign.y) && Math.hypot(sign.x - exit.x, sign.y - exit.y) < 2);
    add(point, { id: `${regionId}:exit:${exit.x}:${exit.y}:${exit.targetRegion}`, name: exit.label, kind: exit.requiresInteraction ? "door" : "road", detail: exit.requiresInteraction ? "Press E at the doorway to enter" : "Walk through the marked boundary to travel", recorded, checkpoint: false }, recorded);
  }
  for (const sign of map.signs) {
    const recorded = signRead(sign.x, sign.y);
    add({ x: (sign.x + .5) * TILE, y: (sign.y + .5) * TILE }, { id: `${regionId}:record:${sign.x}:${sign.y}`, name: sign.title ?? "Field note", kind: "record", detail: sign.townId ? "Town notice board · local requests" : recorded ? "Copied into your field journal" : "Approach and press E to read", recorded, checkpoint: false }, recorded);
  }
  return {
    regionId, regionName: map.regionName, width: map.width, height: map.height,
    player: { x: player.x / TILE, y: player.y / TILE, dir: player.dir },
    landmarks,
    sanctuary: map.towns.find(town => Math.hypot(player.x - town.x, player.y - town.y) < town.safeRadius)?.name ?? null,
    checkpoint: checkpoint ? { name: checkpoint.name, local: checkpoint.regionId === regionId } : null,
  };
}

const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export const HEADING: Record<Dir, string> = { up: "North", right: "East", down: "South", left: "West" };
export const HEADING_ROTATION: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

export function landmarkBearing(from: Vec, to: Vec) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return { distance, tiles: Math.round(distance), direction: BEARINGS[Math.round(angle / 45) % 8], angle, arrived: distance <= 1.5 };
}

export function filterLandmarks(data: NavigationData, query = "", kind: LandmarkKind | "all" = "all", sort: "distance" | "name" = "distance"): Landmark[] {
  const needle = query.trim().toLocaleLowerCase();
  return data.landmarks.filter(landmark => (kind === "all" || landmark.kind === kind) && (!needle || `${landmark.name} ${landmark.detail}`.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : landmarkBearing(data.player, a).distance - landmarkBearing(data.player, b).distance || a.name.localeCompare(b.name));
}

export function atlasBounds(data: NavigationData, fullRegion: boolean) {
  if (fullRegion) return { x: 0, y: 0, width: data.width, height: data.height };
  const points = [data.player, ...data.landmarks];
  const minX = Math.max(0, Math.min(...points.map(point => point.x)) - 7);
  const minY = Math.max(0, Math.min(...points.map(point => point.y)) - 7);
  const maxX = Math.min(data.width, Math.max(...points.map(point => point.x)) + 7);
  const maxY = Math.min(data.height, Math.max(...points.map(point => point.y)) + 7);
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}
