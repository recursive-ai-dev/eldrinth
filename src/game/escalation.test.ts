import { describe, expect, it } from "vitest";
import { applyHarvestCost, shardBleedEntry, shardCostSuffix, shardHarvestCost, shardPickupMessage, WARD_LINES, wardDialogue } from "./escalation";

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

describe("ward dialogue", () => {
  it("carries every one of Orithel's ward lines", () => {
    const { lines } = wardDialogue();
    for (const line of WARD_LINES) expect(lines).toContain(line);
    expect(lines).toHaveLength(WARD_LINES.length);
  });

  it("offers exactly the two ending choices", () => {
    const { choices } = wardDialogue();
    expect(choices.map((choice) => choice.id)).toEqual(["ending:surrender", "ending:refuse"]);
  });
});

describe("harvest cost", () => {
  it("charges nothing for the first two shards", () => {
    expect(shardHarvestCost(1)).toBe(0);
    expect(shardHarvestCost(2)).toBe(0);
  });

  it("follows the approved curve", () => {
    const curve = [1, 1, 1, 2, 2, 3, 3];
    for (let i = 0; i < curve.length; i++) {
      expect(shardHarvestCost(i + 3)).toBe(curve[i]);
    }
  });

  it("costs thirteen max health across a full run", () => {
    let total = 0;
    for (let n = 1; n <= 9; n++) total += shardHarvestCost(n);
    expect(total).toBe(13);
  });

  it("charges nothing outside the nine shards rather than throwing", () => {
    expect(shardHarvestCost(0)).toBe(0);
    expect(shardHarvestCost(10)).toBe(0);
    expect(shardHarvestCost(-1)).toBe(0);
  });

  it("leaves a player at eighteen with five after a full run", () => {
    let maxHp = 18;
    let hp = 18;
    for (let n = 1; n <= 9; n++) ({ maxHp, hp } = applyHarvestCost(maxHp, hp, n));
    expect(maxHp).toBe(5);
    expect(hp).toBe(5);
  });

  it("clamps current health down to the new maximum", () => {
    expect(applyHarvestCost(10, 10, 8)).toEqual({ maxHp: 7, hp: 7 });
  });

  it("leaves a wounded player's current health alone", () => {
    expect(applyHarvestCost(10, 2, 8)).toEqual({ maxHp: 7, hp: 2 });
  });

  it("never drops maximum health below one", () => {
    expect(applyHarvestCost(2, 2, 9)).toEqual({ maxHp: 1, hp: 1 });
    expect(applyHarvestCost(1, 1, 9)).toEqual({ maxHp: 1, hp: 1 });
  });

  it("states the price only once there is one", () => {
    expect(shardCostSuffix(1)).toBe("");
    expect(shardCostSuffix(2)).toBe("");
    expect(shardCostSuffix(3)).toBe(" Maximum health −1.");
    expect(shardCostSuffix(6)).toBe(" Maximum health −2.");
    expect(shardCostSuffix(9)).toBe(" Maximum health −3.");
  });

  it("keeps the first two pickup messages exactly as they were", () => {
    expect(shardPickupMessage(1, 9)).toBe("Anima Shard recovered (1/9).");
    expect(shardPickupMessage(2, 9)).toBe("Anima Shard recovered (2/9).");
  });

  it("appends the price to every costed pickup message", () => {
    expect(shardPickupMessage(3, 9)).toBe("Anima Shard recovered (3/9). It was warm. Maximum health −1.");
    expect(shardPickupMessage(6, 9)).toContain("Maximum health −2.");
  });
});
