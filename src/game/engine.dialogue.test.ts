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
