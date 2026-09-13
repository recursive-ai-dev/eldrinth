import { describe, expect, it } from "vitest";
import { ENDINGS } from "./EndScreen";

describe("ending copy table", () => {
  it("has an entry with the mandated title for each ending", () => {
    expect(ENDINGS.silence.title).toBe("THE SPIRE FALLS SILENT");
    expect(ENDINGS.refusal.title).toBe("THE SPIRE HEARS YOU");
    expect(ENDINGS.spent.title).toBe("YOUR LIGHT FADES");
  });

  it("covers exactly the three ending ids", () => {
    expect(Object.keys(ENDINGS).sort()).toEqual(["refusal", "silence", "spent"]);
  });
});
