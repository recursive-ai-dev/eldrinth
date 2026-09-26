export type SceneId = "title" | "overworld" | "interior" | "menu" | "pause" | "cutscene" | "ending";

/**
 * Which ending a finished run reached. `silence` is the old "win".
 *
 * `spent` is a deliberate walk-away: reaching the Spire short of nine and
 * choosing to stop. It used to mean "died with no wayfire lit", which was
 * nearly unreachable (the first wayfire sits on the only road out of spawn) and
 * punished a player for exploring early with the loss of a whole run.
 */
export type EndingId = "silence" | "refusal" | "spent";

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
