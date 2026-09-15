import { describe, expect, it } from "vitest";
import { Game } from "./engine";

/**
 * openDialogue/advanceDialogue are Game methods, but their choice-attachment
 * behaviour is pure with respect to a handful of fields. Exercising the real
 * prototype methods against a minimal stand-in avoids booting a full Game
 * (which needs a real HTMLCanvasElement + region repository) while still
 * testing the exact code path Finding 1 touched.
 */
function makeDialogueHarness() {
  const dialogueEvents: unknown[] = [];
  const ctx = {
    dialogueLines: [] as string[],
    dialogueSpeaker: "",
    dialogueColor: "",
    dialogue: null as any,
    pendingChoices: null as { id: string; label: string }[] | null,
    advanceLock: 0,
    input: { clear() {} },
    cb: { onDialogue: (d: unknown) => dialogueEvents.push(d) },
    pushHud() {},
  };
  return { ctx, dialogueEvents };
}

describe("dialogue choice attachment", () => {
  it("attaches choices immediately for a single-line dialogue (regression guard for Finding 1)", () => {
    const { ctx } = makeDialogueHarness();
    ctx.pendingChoices = [{ id: "leave", label: "Farewell" }];
    Game.prototype.openDialogue.call(ctx as any, ["Only one line."], "Someone", "#fff");

    expect(ctx.dialogue.choices).toEqual([{ id: "leave", label: "Farewell" }]);
    expect(ctx.dialogue.index).toBe(0);
    expect(ctx.pendingChoices).toBeNull();
  });

  it("defers choices on a multi-line dialogue until the last line is reached", () => {
    const { ctx } = makeDialogueHarness();
    const choices = [
      { id: "ending:surrender", label: "Give him the nine." },
      { id: "ending:refuse", label: "No." },
    ];
    ctx.pendingChoices = choices;
    Game.prototype.openDialogue.call(ctx as any, ["Line one.", "Line two.", "Line three."], "Orithel", "#fff");

    // First line: no choices yet, still on the earlier lines.
    expect(ctx.dialogue.choices).toBeUndefined();
    expect(ctx.pendingChoices).toEqual(choices);

    Game.prototype.advanceDialogue.call(ctx as any);
    expect(ctx.dialogue.index).toBe(1);
    expect(ctx.dialogue.choices).toBeUndefined();

    ctx.advanceLock = 0;
    Game.prototype.advanceDialogue.call(ctx as any);
    expect(ctx.dialogue.index).toBe(2);
    expect(ctx.dialogue.text).toBe("Line three.");
    expect(ctx.dialogue.choices).toEqual(choices);
    expect(ctx.pendingChoices).toBeNull();
  });

  it("does not advance past a dialogue that already has choices attached", () => {
    const { ctx } = makeDialogueHarness();
    ctx.pendingChoices = [{ id: "leave", label: "Farewell" }];
    Game.prototype.openDialogue.call(ctx as any, ["Only one line."], "Someone", "#fff");
    Game.prototype.advanceDialogue.call(ctx as any);
    expect(ctx.dialogue).not.toBeNull();
    expect(ctx.dialogue.index).toBe(0);
  });
});

describe("town NPC dialogue and lore system", () => {
  function makeNpcHarness() {
    const journal: any[] = [];
    const usedServices = new Set<string>();
    const dialogueEvents: unknown[] = [];
    const bursts: any[] = [];
    const ctx = {
      usedTownServices: usedServices,
      world: { journal },
      player: { hp: 10, maxHp: 18 },
      shards: 0,
      publishJournal() {},
      openDialogue(lines: string[], speaker: string, color: string) {
        dialogueEvents.push({ lines, speaker, color });
      },
      burst(x: number, y: number, color: string, count: number) {
        bursts.push({ x, y, color, count });
      },
      townLoreEntry: (Game.prototype as any).townLoreEntry,
    };
    return { ctx, journal, usedServices, dialogueEvents, bursts };
  }

  it("returns authored lore entries for all four regional lore NPCs", () => {
    const loreIds = [
      "town:ilyarael:scrivener",
      "town:cinderwild:kilnmaster",
      "town:moonlit:dredger",
      "town:starfall:stargazer",
    ];
    for (const id of loreIds) {
      const entry = (Game.prototype as any).townLoreEntry(id);
      expect(entry, `Expected entry for ${id}`).not.toBeNull();
      expect(entry.text.length).toBeGreaterThan(60);
      expect(entry.source).toBeDefined();
    }
  });

  it("copies lore to journal and triggers dialogue on first lore NPC conversation", () => {
    const { ctx, journal, usedServices, dialogueEvents } = makeNpcHarness();
    const npc = { id: "town:cinderwild:kilnmaster", name: "Kiln-Master Vance", color: "#ff8c52", role: "lore" as const, x: 100, y: 100 };

    (Game.prototype as any).speakWithTownNpc.call(ctx, npc);
    expect(usedServices.has(npc.id)).toBe(true);
    expect(journal).toHaveLength(1);
    expect(journal[0].title).toBe("What the Chimneys Drank");
    expect(dialogueEvents).toHaveLength(1);
  });

  it("heals player to maxHp and sets service used on first healer conversation", () => {
    const { ctx, usedServices, dialogueEvents } = makeNpcHarness();
    const npc = { id: "town:cinderwild:healer", name: "Cinder-Nurse Greta", color: "#f0a882", role: "healer" as const, x: 100, y: 100 };

    (Game.prototype as any).speakWithTownNpc.call(ctx, npc);
    expect(ctx.player.hp).toBe(18);
    expect(usedServices.has(npc.id)).toBe(true);
    expect(dialogueEvents).toHaveLength(1);

    // Second visit gives exhausted line
    (Game.prototype as any).speakWithTownNpc.call(ctx, npc);
    expect(dialogueEvents).toHaveLength(2);
    expect((dialogueEvents[1] as any).lines[0]).toContain("Save your strength");
  });

  it("offers reactive dialogue from lore NPCs when carrying shards", () => {
    const { ctx, dialogueEvents } = makeNpcHarness();
    const npc = { id: "town:cinderwild:kilnmaster", name: "Kiln-Master Vance", color: "#ff8c52", role: "lore" as const, x: 100, y: 100 };

    // First visit copies lore
    (Game.prototype as any).speakWithTownNpc.call(ctx, npc);

    // Second visit with shards
    ctx.shards = 3;
    (Game.prototype as any).speakWithTownNpc.call(ctx, npc);
    expect(dialogueEvents).toHaveLength(2);
    expect((dialogueEvents[1] as any).lines[0]).toContain("carrying one of them");
  });
});

describe("shard intake recording in fortresses", () => {
  it("copies the specific intake docket into the journal when taking a shard inside a fortress", () => {
    const journal: any[] = [];
    const ctx = {
      world: { regionId: "fortress.old-lands-archive", journal },
      player: { x: 100, y: 100, r: 12, hp: 18, maxHp: 18 },
      items: [{ x: 100, y: 100, type: "shard", taken: false }],
      shards: 0,
      totalShards: 9,
      shardsBurst() {},
      addText() {},
      publishJournal() {},
      msg() {},
    };
    (Game.prototype as any).checkPickups.call(ctx);
    expect(ctx.shards).toBe(1);
    expect(journal.some((entry) => entry.id === "intake:vaelen")).toBe(true);
    expect(journal.find((entry) => entry.id === "intake:vaelen")?.title).toContain("Archivist Vaelen");
  });
});


