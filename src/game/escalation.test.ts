import { describe, expect, it } from "vitest";
import { shardBleedEntry, shardPickupMessage } from "./escalation";

describe("shard escalation", () => {
  it("reports a plain count for the early shards", () => {
    expect(shardPickupMessage(1, 9)).toBe("Anima Shard recovered (1/9).");
    expect(shardPickupMessage(2, 9)).toBe("Anima Shard recovered (2/9).");
  });

  it("darkens once the player is deep enough to notice", () => {
    expect(shardPickupMessage(6, 9)).toContain("still talking");
    expect(shardPickupMessage(8, 9)).toContain("done this before");
  });

  it("always names the running count", () => {
    for (let n = 1; n <= 9; n++) expect(shardPickupMessage(n, 9)).toContain(`(${n}/9)`);
  });

  it("writes nothing in the player's hand before the sixth", () => {
    for (let n = 1; n <= 5; n++) expect(shardBleedEntry(n)).toBeNull();
  });

  it("bleeds the courier's voice into the journal from the sixth", () => {
    for (const n of [6, 7, 8]) {
      const entry = shardBleedEntry(n);
      expect(entry).not.toBeNull();
      expect(entry?.id).toBe(`bleed:${n}`);
      expect(entry?.source).toBe("My own hand");
    }
    expect(shardBleedEntry(8)?.text).toContain("Do not surrender it");
  });
});
