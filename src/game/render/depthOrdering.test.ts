import { afterEach, describe, expect, it, vi } from "vitest";
import { T } from "../constants";
import type { MapData } from "../types";
import { renderGame, TileChunkRenderer, type RenderState } from "./renderer";

vi.mock("./spriteAtlas", () => ({
  getAtlasRevision: () => 0,
  preloadAtlases: async () => undefined,
  loadAtlas: (key: string) => ({
    ready: true, image: key,
    getFrame: () => ({ sx: 0, sy: 0, sw: 32, sh: 32 }),
    getStaticFrame: () => ({ sx: 0, sy: 0, sw: 32, sh: 32 }),
  }),
}));
afterEach(() => vi.unstubAllGlobals());

function context(drawImage = vi.fn()) {
  return new Proxy({ drawImage }, {
    get(target, key) {
      if (key === "drawImage") return target.drawImage;
      if (key === "createRadialGradient" || key === "createLinearGradient") return () => ({ addColorStop() {} });
      return () => undefined;
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

describe("world depth ordering", () => {
  it.each([T.ROCK, T.TREE, T.RWALL, T.INTERIOR_WALL])("sorts characters on both sides of terrain %s", tile => {
    const canvases: object[] = [];
    vi.stubGlobal("document", { createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => context() };
      canvases.push(canvas);
      return canvas;
    } });
    const map = {
      width: 3, height: 3, tiles: new Uint8Array([T.GRASS, tile, T.GRASS, ...Array(6).fill(T.GRASS)]),
      towns: [], signs: [], lights: [], campfires: [], npcs: [], npc: { x: 0, y: 0 }, dark: false,
    } as unknown as MapData;
    const drawImage = vi.fn();
    const game = {
      ctx: context(drawImage), map, tileRenderer: new TileChunkRenderer(map),
      cam: { x: 0, y: 0 }, dpr: 1, cssW: 96, cssH: 96, viewW: 96, viewH: 96,
      time: 0, wardUnlocked: true, shakeMag: 0,
      player: { x: 48, y: 10, r: 10, dir: "down", walkT: 0 },
      enemies: [], items: [], projectiles: [], particles: [], texts: [], settlementStates: [],
    } as unknown as RenderState;
    const order = () => {
      const calls = drawImage.mock.calls;
      return {
        player: calls.findIndex(args => args[0] === "player"),
        terrain: calls.findIndex(args => args[0] === canvases[1] && args[2] === 0),
      };
    };
    renderGame(game);
    expect(order().player).toBeGreaterThanOrEqual(0);
    expect(order().terrain).toBeGreaterThan(order().player);
    drawImage.mockClear();
    game.player.y = 33;
    renderGame(game);
    expect(order().terrain).toBeGreaterThanOrEqual(0);
    expect(order().player).toBeGreaterThan(order().terrain);
  });
});
