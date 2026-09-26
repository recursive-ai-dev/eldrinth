import { describe, expect, it } from "vitest";
import { epilogueLines } from "./epilogue";
import { TOWN_PROJECTS, completeTownProject, type QuestProgress } from "./quests";

const base = {
  wardenAccounts: 0,
  townProjects: 0,
  deaths: 0,
  shards: 9,
  totalShards: 9,
  difficulty: "standard",
};

function progressWith(resolutions: Record<string, string>, facts: string[] = []): QuestProgress {
  return { facts, resolutions };
}

describe("epilogue", () => {
  it("says plainly that nothing was investigated when nothing was", () => {
    const lines = epilogueLines({ ...base, progress: progressWith({}) });
    expect(lines.join(" ")).toMatch(/without opening a single one of his files/);
  });

  it("names the choice made in each resolved investigation", () => {
    const lines = epilogueLines({
      ...base,
      progress: progressWith({ courier: "bind", salt: "mercy", dawn: "temper" }),
    }).join(" ");

    expect(lines).toMatch(/gave the child to your blade/);
    expect(lines).toMatch(/let the names stay quiet/);
    expect(lines).toMatch(/folded the astronomer into your blade/);
  });

  it("gives a different account for a different choice in the same investigation", () => {
    const bind = epilogueLines({ ...base, progress: progressWith({ courier: "bind" }) }).join(" ");
    const release = epilogueLines({ ...base, progress: progressWith({ courier: "release" }) }).join(" ");
    const end = epilogueLines({ ...base, progress: progressWith({ courier: "end" }) }).join(" ");

    expect(new Set([bind, release, end]).size).toBe(3);
  });

  it("counts the investigations left unopened", () => {
    const lines = epilogueLines({ ...base, progress: progressWith({ courier: "bind" }) }).join(" ");
    expect(lines).toMatch(/3 of his files stand unopened/);
  });

  it("reports completed town requests by name", () => {
    const progress = progressWith({});
    for (const project of TOWN_PROJECTS) {
      // Satisfy the requirements, then complete it, so the epilogue reads the
      // same signal the game does.
      for (const fact of project.requirements) if (!progress.facts.includes(fact)) progress.facts.push(fact);
      completeTownProject(progress, project.id);
    }
    const lines = epilogueLines({ ...base, progress, townProjects: TOWN_PROJECTS.length }).join(" ");
    expect(lines).toMatch(new RegExp(`${TOWN_PROJECTS.length} of the ${TOWN_PROJECTS.length} requests`));
    expect(lines).toMatch(/ledger room/);
  });

  it("distinguishes knowing every warden from knowing some", () => {
    const all = epilogueLines({ ...base, progress: progressWith({}), wardenAccounts: 9 }).join(" ");
    const some = epilogueLines({ ...base, progress: progressWith({}), wardenAccounts: 3 }).join(" ");

    expect(all).toMatch(/all nine of them/);
    expect(some).toMatch(/3 of the 9/);
  });

  it("records how many times the road took the pilgrim", () => {
    expect(epilogueLines({ ...base, progress: progressWith({}), deaths: 1 }).join(" ")).toMatch(/took me once/);
    expect(epilogueLines({ ...base, progress: progressWith({}), deaths: 4 }).join(" ")).toMatch(/took me 4 times/);
    expect(epilogueLines({ ...base, progress: progressWith({}), deaths: 0 }).join(" ")).not.toMatch(/took me/);
  });
});
