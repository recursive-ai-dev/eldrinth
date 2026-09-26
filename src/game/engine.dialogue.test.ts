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
      world: { journal, quests: { facts: [], resolutions: {} } },
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
      townScoutEntry: (Game.prototype as any).townScoutEntry,
      scoutQuestId: (Game.prototype as any).scoutQuestId,
      openNpcDialogue: (Game.prototype as any).openNpcDialogue,
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

  it("gives scouts a journal route and starts their associated side quest", () => {
    const { ctx, journal, dialogueEvents } = makeNpcHarness();
    const npc = { id: "town:cinderwild:outrunner", name: "Elodie the Outrunner", color: "#e0b084", role: "scout" as const, x: 100, y: 100 };

    (Game.prototype as any).speakWithTownNpc.call(ctx, npc);

    expect(ctx.world.quests.facts).toContain("lead:courier");
    expect(journal[0]?.id).toBe("town:cinderwild:outrunner");
    expect(dialogueEvents[0] as any).toMatchObject({ speaker: npc.name, color: npc.color });
    expect((dialogueEvents[0] as any).lines[1]).toContain("The Courier Who Never Came");
  });

  it("returns authored healer testimonies for all four regional healers", () => {
    const healerIds = [
      "town:ilyarael:healer",
      "town:cinderwild:healer",
      "town:moonlit:healer",
      "town:starfall:healer",
    ];
    for (const id of healerIds) {
      const entry = (Game.prototype as any).townHealerEntry(id);
      expect(entry, `Expected healer entry for ${id}`).not.toBeNull();
      expect(entry.title.length).toBeGreaterThan(5);
      expect(entry.text.length).toBeGreaterThan(60);
      expect(entry.source).toBeDefined();
    }
  });

  it("returns fortress codex entries documenting all nine conscious minds across four regions", () => {
    const testCases = [
      { id: "town:ilyarael:scrivener", minds: ["Vaelen", "Theon", "Morwyn"] },
      { id: "town:cinderwild:kilnmaster", minds: ["Roryn", "Kaelen"] },
      { id: "town:moonlit:dredger", minds: ["Maris", "Alden"] },
      { id: "town:starfall:stargazer", minds: ["Selene", "Orren"] },
    ];
    for (const { id, minds } of testCases) {
      const entry = (Game.prototype as any).townFortressLore(id);
      expect(entry, `Expected fortress lore for ${id}`).not.toBeNull();
      expect(entry.text.length).toBeGreaterThan(100);
      for (const mind of minds) {
        expect(entry.text).toContain(mind);
      }
    }
  });

  it("builds topic choices for town NPCs including fortress inquiry and shard resonance", () => {
    const npc = { id: "town:ilyarael:scrivener", name: "Scribe Althea", color: "#c9a86c", role: "lore" as const, x: 0, y: 0 };
    const ctxNoShards = { shards: 0 };
    const choicesNoShards = (Game.prototype as any).townNpcChoices.call(ctxNoShards, npc);
    expect(choicesNoShards.map((c: any) => c.id)).toEqual([
      "npc:topic:town:ilyarael:scrivener:fortress",
      "npc:topic:town:ilyarael:scrivener:backstory",
      "leave",
    ]);

    const ctxWithShards = { shards: 2 };
    const choicesWithShards = (Game.prototype as any).townNpcChoices.call(ctxWithShards, npc);
    expect(choicesWithShards.map((c: any) => c.id)).toContain("npc:topic:town:ilyarael:scrivener:shards");
  });

  it("handles interactive topics by recording lore in journal and displaying detailed dialogue", () => {
    const journal: any[] = [];
    const dialogueCalls: any[] = [];
    const npc = {
      id: "town:ilyarael:healer",
      name: "Hollow Sister Mirene",
      color: "#8fcca8",
      role: "healer" as const,
      portrait: { id: "sister-mirene", description: "A solemn woman in a sea-green veil" },
      x: 100,
      y: 100,
    };
    const ctx = {
      map: { npcs: [npc] },
      world: { journal, quests: { facts: [], resolutions: {} } },
      shards: 3,
      pendingChoices: null,
      publishJournal() {},
      openDialogue(lines: string[], speaker: string, color: string, portrait?: any, subtitle?: string) {
        dialogueCalls.push({ lines, speaker, color, portrait, subtitle });
      },
      townFortressLore: (Game.prototype as any).townFortressLore,
      townHealerEntry: (Game.prototype as any).townHealerEntry,
      townScoutEntry: (Game.prototype as any).townScoutEntry,
      townLoreEntry: (Game.prototype as any).townLoreEntry,
      townNpcChoices: (Game.prototype as any).townNpcChoices,
    };

    // 1. Ask about fortress
    (Game.prototype as any).handleNpcTopic.call(ctx, npc.id, "fortress");
    expect(journal.some((e) => e.id === "codex:fortress:old-lands")).toBe(true);
    expect(dialogueCalls[0].subtitle).toContain("FORTRESS CODEX");
    expect(dialogueCalls[0].portrait?.id).toBe("sister-mirene");

    // 2. Ask about backstory (healer vow)
    (Game.prototype as any).handleNpcTopic.call(ctx, npc.id, "backstory");
    expect(journal.some((e) => e.id === "town:ilyarael:healer")).toBe(true);
    expect(dialogueCalls[1].subtitle).toContain("TESTIMONY");

    // 3. Ask about shards carried
    (Game.prototype as any).handleNpcTopic.call(ctx, npc.id, "shards");
    expect(dialogueCalls[2].lines[0]).toContain("3 living minds");
    expect(dialogueCalls[2].subtitle).toContain("SHARD RESONANCE");
  });
});

describe("shard intake recording in fortresses", () => {
  it("copies the specific intake docket into the journal when taking a shard inside a fortress", () => {
    const journal: any[] = [];
    const ctx = {
      world: { regionId: "fortress.old-lands-archive", journal, harvestedShards: new Set<string>() },
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
    expect(ctx.world.harvestedShards.has("fortress.old-lands-archive")).toBe(true);
    expect(journal.some((entry) => entry.id === "intake:vaelen")).toBe(true);
    expect(journal.find((entry) => entry.id === "intake:vaelen")?.title).toContain("Archivist Vaelen");
  });

  /**
   * Dying inside a fortress discards that region's saved state, so the shard is
   * re-seeded on re-entry. The count has to be keyed on the vessel rather than
   * the pickup, or the counter farms past nine and the "nine people" premise
   * stops meaning anything.
   */
  it("does not re-award a shard from a fortress that was already emptied", () => {
    const journal: any[] = [];
    const ctx = {
      world: {
        regionId: "fortress.old-lands-archive",
        journal,
        harvestedShards: new Set(["fortress.old-lands-archive"]),
      },
      player: { x: 100, y: 100, r: 12, hp: 18, maxHp: 18 },
      items: [{ x: 100, y: 100, type: "shard", taken: false }],
      shards: 1,
      totalShards: 9,
      shardsBurst() {},
      addText() {},
      publishJournal() {},
      msg() {},
    };
    (Game.prototype as any).checkPickups.call(ctx);
    expect(ctx.shards).toBe(1);
    expect(journal).toEqual([]);
    // The stale item is still cleared out of the region.
    expect(ctx.items).toEqual([]);
  });
});

