import { describe, expect, it } from "vitest";
import { SIGN_READ_RADIUS, TILE } from "./constants";
import { interactionPrompt, selectInteraction, type InteractionState } from "./interactions";
import { SHARD_INTERACT_RADIUS } from "./voices";

function emptyState(): InteractionState {
  return {
    player: { x: 48, y: 48 },
    items: [],
    map: {
      npc: { x: -9999, y: -9999 },
      npcs: [],
      exits: [],
      signs: [],
      campfires: [],
    },
  };
}

describe("shared interaction selection", () => {
  it("keeps an unheard shard ahead of nearby services but ignores taken shards and potions", () => {
    const state = emptyState();
    const shard = { type: "shard", taken: false, x: 50, y: 48 };
    state.items = [{ type: "potion", taken: false, x: 48, y: 48 }, shard];
    state.map.campfires = [{ x: 48, y: 48 }];
    expect(selectInteraction(state)).toEqual({ kind: "shard", target: shard });
    shard.taken = true;
    expect(selectInteraction(state)?.kind).toBe("fire");
  });

  it("prefers the closer inhabitant to a doorway even when a wayfire is closer still", () => {
    const state = emptyState();
    const npc = { x: 52, y: 48, name: "Althea" };
    state.map.npcs = [npc];
    state.map.exits = [{ x: 2, y: 1, label: "Ledger Room", requiresInteraction: true }];
    state.map.campfires = [{ x: 48, y: 48 }];
    const selected = selectInteraction(state);
    expect(selected).toEqual({ kind: "npc", target: npc });
    expect(interactionPrompt(selected)).toBe("Press E to speak with Althea");
  });

  it("prefers a closer doorway to an inhabitant and a wayfire, with the doorway winning ties", () => {
    const state = emptyState();
    const door = { x: 1, y: 1, label: "Ledger Room", requiresInteraction: true };
    state.map.exits = [door];
    state.map.npcs = [{ x: 60, y: 48, name: "Althea" }];
    state.map.campfires = [{ x: 48, y: 48 }];
    expect(selectInteraction(state)).toEqual({ kind: "doorway", target: door });
    state.map.npcs = [{ x: 48, y: 48, name: "Althea" }];
    expect(selectInteraction(state)?.kind).toBe("doorway");
  });

  it("selects the nearest target of each kind regardless of authored array order", () => {
    const state = emptyState();
    const nearNpc = { x: 50, y: 48, name: "Near" };
    state.map.npcs = [{ x: 80, y: 48, name: "Far" }, nearNpc];
    expect(selectInteraction(state)?.target).toBe(nearNpc);
    state.map.npcs = [];
    const nearDoor = { x: 1, y: 1, label: "Near room", requiresInteraction: true };
    state.map.exits = [{ x: 2, y: 1, label: "Far room", requiresInteraction: true }, nearDoor];
    expect(selectInteraction(state)?.target).toBe(nearDoor);
    state.map.exits = [];
    const nearSign = { x: 1, y: 1, text: "Near note" };
    state.map.signs = [{ x: 2, y: 1, text: "Far note" }, nearSign];
    expect(selectInteraction(state)?.target).toBe(nearSign);
  });

  it("retains fire, Watcher, then note priority and leaves walk-through gates to movement", () => {
    const state = emptyState();
    state.map.npc = { x: 48, y: 48 };
    state.map.campfires = [{ x: 48, y: 48 }];
    state.map.signs = [{ x: 1, y: 1, text: "Read me" }];
    state.map.exits = [{ x: 1, y: 1, label: "Frontier" }];
    expect(selectInteraction(state)?.kind).toBe("fire");
    state.map.campfires = [];
    expect(selectInteraction(state)?.kind).toBe("watcher");
    state.map.npc = { x: -9999, y: -9999 };
    expect(selectInteraction(state)?.kind).toBe("sign");
    state.map.signs = [];
    expect(selectInteraction(state)).toBeNull();
    expect(interactionPrompt(null)).toBe("");
  });

  it("uses the engine's full 48-pixel inhabitant radius, excluding its outer boundary", () => {
    const state = emptyState();
    state.map.npcs = [{ x: state.player.x + 46, y: state.player.y, name: "Mirene" }];
    expect(interactionPrompt(selectInteraction(state))).toBe("Press E to speak with Mirene");
    state.map.npcs = [{ x: state.player.x + 48, y: state.player.y, name: "Mirene" }];
    expect(selectInteraction(state)).toBeNull();
  });

  it("keeps pixel and tile distances distinct at strict reading and shard boundaries", () => {
    const state = emptyState();
    state.map.signs = [{ x: 1, y: 1, text: "Read me" }];
    state.player.x = TILE + TILE / 2 + SIGN_READ_RADIUS;
    expect(selectInteraction(state)).toBeNull();
    state.player.x -= 0.1;
    expect(selectInteraction(state)?.kind).toBe("sign");
    state.map.signs = [];
    state.items = [{ type: "shard", taken: false, x: state.player.x + SHARD_INTERACT_RADIUS, y: state.player.y }];
    expect(selectInteraction(state)).toBeNull();
  });

  it("retains concrete target metadata needed by engine handlers", () => {
    const state = emptyState();
    const fire = { x: 48, y: 48, name: "Last Ember", relic: "emberheart" };
    const selected = selectInteraction({ ...state, map: { ...state.map, campfires: [fire] } });
    expect(selected?.kind).toBe("fire");
    if (selected?.kind === "fire") expect(selected.target.relic).toBe("emberheart");
  });
});
