import { describe, expect, it } from "vitest";
import { SceneStack } from "./SceneStack";

describe("SceneStack", () => {
  it("keeps an overworld beneath a pause overlay", () => {
    const scenes = new SceneStack(["overworld"]);
    scenes.push("pause");

    expect(scenes.snapshot()).toEqual(["overworld", "pause"]);
    expect(scenes.top()).toBe("pause");
    scenes.pop();
    expect(scenes.top()).toBe("overworld");
  });

  it("replaces the world with a single ending scene", () => {
    const scenes = new SceneStack(["overworld"]);
    scenes.replace("ending");

    expect(scenes.snapshot()).toEqual(["ending"]);
    expect(scenes.has("overworld")).toBe(false);
  });
});
