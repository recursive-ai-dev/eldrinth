import { describe, expect, it } from "vitest";
import { QUESTS, TOWN_PROJECTS, canCompleteTownProject, canResolve, completeTownProject, learnFact, resolveQuest, settlementState, townProjectComplete, type QuestProgress } from "./quests";

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

  it("resolves the pilgrim investigation only after both identity records are found", () => {
    const progress: QuestProgress = { facts: ["lead:pilgrim", "pilgrim-ledger"], resolutions: {} };
    const quest = QUESTS.find((entry) => entry.id === "pilgrim");
    if (!quest) throw new Error("Missing pilgrim quest");

    expect(canResolve(progress, quest)).toBe(false);
    learnFact(progress, "pilgrim-reflection");
    expect(resolveQuest(progress, "pilgrim", "name")?.reward).toEqual({ stat: "stamina", amount: 10 });
  });

  it("completes a town project once all of its local facts are known", () => {
    const progress: QuestProgress = { facts: [], resolutions: {} };
    const project = TOWN_PROJECTS.find((entry) => entry.id === "cinder-haven:kiln");
    if (!project) throw new Error("Missing Cinder Haven kiln project");

    expect(canCompleteTownProject(progress, project)).toBe(false);
    learnFact(progress, "town:cinderwild:kilnmaster");
    learnFact(progress, "courier-memory");
    expect(canCompleteTownProject(progress, project)).toBe(true);
    expect(completeTownProject(progress, project.id)?.reward).toEqual({ stat: "blade", amount: 1 });
    expect(townProjectComplete(progress, project.id)).toBe(true);
    expect(completeTownProject(progress, project.id)).toBeNull();
  });

  it("derives refugees, lamps, and guards from persistent progress", () => {
    const progress: QuestProgress = { facts: ["dawn-record"], resolutions: {} };
    expect(settlementState(progress, "crater-watch", 3)).toMatchObject({ refugees: 1, lamps: 1, guarded: false, closedBusinesses: 0 });

    progress.resolutions["town:crater-watch:path"] = "completed";
    expect(settlementState(progress, "crater-watch", 3)).toMatchObject({ refugees: 2, lamps: 2, completedProjects: 1 });

    expect(settlementState({ facts: [], resolutions: {} }, "crater-watch", 6)).toMatchObject({ guarded: true, closedBusinesses: 1 });
  });
});
