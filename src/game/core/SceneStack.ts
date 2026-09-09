export type SceneId = "title" | "overworld" | "interior" | "menu" | "pause" | "cutscene" | "win" | "lose";

/** A small, explicit stack. Overlay scenes never replace the world beneath them. */
export class SceneStack {
  private readonly scenes: SceneId[];

  constructor(initial: readonly SceneId[] = ["title"]) {
    if (initial.length === 0) throw new Error("A scene stack must contain a root scene.");
    this.scenes = [...initial];
  }

  snapshot(): readonly SceneId[] {
    return this.scenes;
  }

  top(): SceneId {
    return this.scenes[this.scenes.length - 1];
  }

  replace(scene: SceneId) {
    this.scenes.splice(0, this.scenes.length, scene);
  }

  push(scene: SceneId) {
    this.scenes.push(scene);
  }

  pop(): SceneId | undefined {
    return this.scenes.length > 1 ? this.scenes.pop() : undefined;
  }

  has(scene: SceneId): boolean {
    return this.scenes.includes(scene);
  }
}
