import { describe, expect, it } from "vitest";
import { TILE, T } from "./constants";
import { atlasBounds, filterLandmarks, landmarkBearing, navigationData } from "./navigation";
import type { MapData } from "./types";

function fixture() {
  const map: MapData = {
    regionName: "The test road", width: 60, height: 40, tiles: new Uint8Array(60 * 40), wardTiles: [], spawn: { x: 80, y: 80 },
    npcs: [], npc: { x: -1000, y: -1000 }, signs: [], shards: [], enemySpawns: [], bossCenter: { x: 1200, y: 800 }, exits: [], campfires: [], towns: [], dark: false, resetOnDeath: false, lights: [],
  };
  return { regionId: "road", map, player: { x: 80, y: 80, dir: "right" as const }, journal: [], checkpoint: null };
}

describe("discovery-limited navigation", () => {
  it("converts map coordinates to a shared tile space without exposing distant sites", () => {
    const state = fixture();
    state.map.signs = [{ x: 4, y: 2, text: "A readied record", title: "Near record" }, { x: 45, y: 30, text: "Hidden", title: "Hidden record" }];
    state.map.campfires = [{ x: 176, y: 80, name: "Ember", relic: "emberheart" }];
    const data = navigationData(state);
    expect(data.player).toEqual({ x: 2.5, y: 2.5, dir: "right" });
    expect(data.landmarks.map(item => item.name)).toEqual(["Ember", "Near record"]);
    expect(data.landmarks.find(item => item.name === "Near record")).toMatchObject({ x: 4.5, y: 2.5, recorded: false });
    expect(data.landmarks.find(item => item.name === "Ember")).toMatchObject({ x: 5.5, y: 2.5 });
  });

  it("requires a clear sightline for new landmarks, while copied records remain known", () => {
    const state = fixture();
    state.map.tiles[2 * 60 + 4] = T.RWALL;
    state.map.signs = [{ x: 6, y: 2, text: "Beyond the wall", title: "Hidden note" }];
    expect(navigationData(state).landmarks).toEqual([]);
    const read = navigationData({ ...state, journal: [{ id: "road:6:2", title: "Hidden note", text: "Read previously" }] });
    expect(read.landmarks[0]).toMatchObject({ name: "Hidden note", recorded: true });
  });

  it("retains only supplied discoveries and never leaks IDs across regions", () => {
    const state = fixture();
    state.map.signs = [{ x: 45, y: 30, text: "Known remotely", title: "Old record" }];
    const discoveredIds = new Set(["road:record:45:30"]);
    expect(navigationData({ ...state, discoveredIds }).landmarks).toHaveLength(1);
    expect(navigationData({ ...state, regionId: "other-road", discoveredIds }).landmarks).toHaveLength(0);
    expect([...discoveredIds]).toEqual(["road:record:45:30"]);
  });

  it("marks the active wayfire and keeps a foreign checkpoint out of the local chart", () => {
    const state = fixture();
    state.map.campfires = [{ x: 1400, y: 800, name: "Far ember", relic: "ashstep" }];
    const checkpoint = { regionId: "road", x: 1400, y: 800, name: "Far ember" };
    const local = navigationData({ ...state, checkpoint });
    expect(local.landmarks[0]).toMatchObject({ kind: "wayfire", checkpoint: true, recorded: true });
    expect(local.checkpoint).toEqual({ name: "Far ember", local: true });
    const foreign = navigationData({ ...state, checkpoint: { ...checkpoint, regionId: "elsewhere" } });
    expect(foreign.landmarks).toHaveLength(0);
    expect(foreign.checkpoint).toEqual({ name: "Far ember", local: false });
  });

  it("shows sanctuary status only inside the settlement radius", () => {
    const state = fixture();
    state.map.towns = [{ id: "haven", name: "Haven", x: 80, y: 80, safeRadius: 64, buildings: [] }];
    expect(navigationData(state).sanctuary).toBe("Haven");
    expect(navigationData({ ...state, player: { ...state.player, x: 144 } }).sanctuary).toBeNull();
  });

  it("uses recorded settlement testimony to rediscover a distant safe place", () => {
    const state = fixture();
    state.map.towns = [{ id: "haven", name: "Haven", x: 900, y: 800, safeRadius: 64, buildings: [], npcs: [{ id: "healer:haven", name: "Healer", x: 900, y: 800, color: "#fff", role: "healer" }] }];
    expect(navigationData(state).landmarks).toHaveLength(0);
    expect(navigationData({ ...state, journal: [{ id: "healer:haven", title: "Healer", text: "Testimony" }] }).landmarks[0]).toMatchObject({ kind: "town", recorded: true });
  });

  it("distinguishes doors from walk-through roads and learns adjacent exits from a read sign", () => {
    const state = fixture();
    state.map.signs = [{ x: 45, y: 30, text: "Road marker" }];
    state.map.exits = [{ x: 45, y: 30, label: "Far road", targetRegion: "frontier", destination: { x: 80, y: 80 } }, { x: 4, y: 2, label: "Workshop", targetRegion: "workshop", destination: { x: 80, y: 80 }, requiresInteraction: true }];
    const data = navigationData({ ...state, journal: [{ id: "road:45:30", title: "Road", text: "Copied" }] });
    expect(data.landmarks.find(item => item.name === "Far road")).toMatchObject({ kind: "road", recorded: true, x: 45.5 });
    expect(data.landmarks.find(item => item.name === "Workshop")).toMatchObject({ kind: "door", recorded: false });
  });

  it("can chart an object on a wall without seeing through the wall beyond it", () => {
    const state = fixture();
    state.map.tiles[2 * 60 + 4] = T.RWALL;
    state.map.signs = [{ x: 4, y: 2, text: "Wall plaque" }, { x: 5, y: 2, text: "Beyond wall" }];
    expect(navigationData(state).landmarks.map(item => item.x)).toEqual([4.5]);
  });
});

describe("atlas bearings and filtering", () => {
  it.each([
    [0, -10, "N"], [10, -10, "NE"], [10, 0, "E"], [10, 10, "SE"],
    [0, 10, "S"], [-10, 10, "SW"], [-10, 0, "W"], [-10, -10, "NW"],
  ])("uses world north for bearing (%s, %s)", (x, y, direction) => {
    expect(landmarkBearing({ x: 0, y: 0 }, { x: Number(x), y: Number(y) }).direction).toBe(direction);
  });

  it("reports arrival only inside interaction-sized proximity", () => {
    expect(landmarkBearing({ x: 2, y: 2 }, { x: 2, y: 2 })).toMatchObject({ tiles: 0, arrived: true });
    expect(landmarkBearing({ x: 0, y: 0 }, { x: 2, y: 0 })).toMatchObject({ tiles: 2, arrived: false });
  });

  it("filters case-insensitively by name/detail, sorts, and preserves input order", () => {
    const state = fixture();
    state.map.signs = [{ x: 6, y: 2, text: "", title: "Alpha record" }, { x: 3, y: 2, text: "", title: "Zeta record" }];
    state.map.campfires = [{ x: 4 * TILE, y: 80, name: "Ember", relic: "emberheart" }];
    const data = navigationData(state);
    const original = data.landmarks.map(item => item.id);
    expect(filterLandmarks(data, " RECORD ", "record").map(item => item.name)).toEqual(["Zeta record", "Alpha record"]);
    expect(filterLandmarks(data, "", "all", "name").map(item => item.name)).toEqual(["Alpha record", "Ember", "Zeta record"]);
    expect(filterLandmarks(data, "stamina").map(item => item.name)).toEqual(["Ember"]);
    expect(data.landmarks.map(item => item.id)).toEqual(original);
  });

  it("keeps focused chart bounds inside the map, including an empty chart at the edge", () => {
    const data = navigationData(fixture());
    expect(atlasBounds(data, true)).toEqual({ x: 0, y: 0, width: 60, height: 40 });
    const focused = atlasBounds({ ...data, player: { x: 59.5, y: 39.5, dir: "left" } }, false);
    expect(focused.x + focused.width).toBe(60);
    expect(focused.y + focused.height).toBe(40);
    expect(focused.width).toBeGreaterThan(0);
  });
});
