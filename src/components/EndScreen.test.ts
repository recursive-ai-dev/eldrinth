import { describe, expect, it } from "vitest";
import { ENDINGS } from "./EndScreen";

describe("ending copy table", () => {
  it("has an entry with the mandated title for each ending", () => {
    expect(ENDINGS.silence.title).toBe("THE SPIRE FALLS SILENT");
    expect(ENDINGS.refusal.title).toBe("THE SPIRE HEARS YOU");
    expect(ENDINGS.spent.title).toBe("YOU TURN BACK");
  });

  it("covers exactly the three ending ids", () => {
    expect(Object.keys(ENDINGS).sort()).toEqual(["refusal", "silence", "spent"]);
  });

  // The refusal copy ends on "It is not rescue. It is not over.", so a button
  // reading STAY contradicts it — and the action starts an entirely new run.
  it("does not label a new run as staying", () => {
    for (const ending of ["silence", "refusal", "spent"] as const) {
      expect(ENDINGS[ending].button).toBe("WALK AGAIN");
    }
  });
});
