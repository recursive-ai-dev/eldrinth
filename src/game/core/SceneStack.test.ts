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
});
