import { describe, expect, it } from "vitest";
import { QUESTS, canResolve, learnFact, resolveQuest, type QuestProgress } from "./quests";

describe("quest progress", () => {
  it("allows discoveries in any order and resolves a decision once", () => {
    const progress: QuestProgress = { facts: [], resolutions: {} };
    const quest = QUESTS.find((entry) => entry.id === "courier");
    if (!quest) throw new Error("Missing courier quest");

    learnFact(progress, "courier-memory");
    learnFact(progress, "courier-orders");

    expect(canResolve(progress, quest)).toBe(true);
    expect(resolveQuest(progress, quest.id, "release")?.reward).toEqual({ stat: "health", amount: 2 });
    expect(canResolve(progress, quest)).toBe(false);
    expect(resolveQuest(progress, quest.id, "bind")).toBeNull();
  });
});
