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

  it("resolves the courier's rewardless choice and records it", () => {
    const progress: QuestProgress = { facts: [], resolutions: {} };
    const quest = QUESTS.find((entry) => entry.id === "courier");
    if (!quest) throw new Error("Missing courier quest");

    learnFact(progress, "courier-orders");
    learnFact(progress, "courier-memory");

    const choice = resolveQuest(progress, quest.id, "end");
    expect(choice).not.toBeNull();
    expect(choice?.reward).toBeUndefined();
    expect(progress.resolutions.courier).toBe("end");
    expect(canResolve(progress, quest)).toBe(false);
  });

  it("keeps rewards on the courier's two rewarded choices", () => {
    const bind: QuestProgress = { facts: ["courier-orders", "courier-memory"], resolutions: {} };
    expect(resolveQuest(bind, "courier", "bind")?.reward).toEqual({ stat: "blade", amount: 1 });

    const release: QuestProgress = { facts: ["courier-orders", "courier-memory"], resolutions: {} };
    expect(resolveQuest(release, "courier", "release")?.reward).toEqual({ stat: "health", amount: 2 });
  });
});
