import { describe, expect, it } from "vitest";
import { applyHarvestCost, cumulativeHarvestCost, fortressShardIntakeEntry, fortressWardenEntry, shardBleedEntry, shardBladeBonus, shardCostSuffix, shardHarvestCost, shardPickupMessage, wardenFact, WARD_LINES, wardDialogue, wardUnlockMessage } from "./escalation";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";

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
    expect(shardCostSuffix(3)).toContain("Maximum health −1.");
    expect(shardCostSuffix(6)).toContain("Maximum health −2.");
    expect(shardCostSuffix(9)).toContain("Maximum health −3.");
  });

  it("keeps the first two pickup messages exactly as they were", () => {
    expect(shardPickupMessage(1, 9)).toBe("Anima Shard recovered (1/9).");
    expect(shardPickupMessage(2, 9)).toBe("Anima Shard recovered (2/9).");
  });

  it("appends the price to every costed pickup message", () => {
    expect(shardPickupMessage(3, 9)).toContain("Maximum health −1.");
    expect(shardPickupMessage(6, 9)).toContain("Maximum health −2.");
  });

  it("announces the blade gain only on the shard that grants it", () => {
    // Shard 3 is the first that makes the blade cut deeper; 4 and 5 change
    // nothing blade-wise, so the message must not claim they did.
    expect(shardPickupMessage(3, 9)).toContain("Blade damage +1.");
    expect(shardPickupMessage(4, 9)).not.toContain("Blade damage");
    expect(shardPickupMessage(5, 9)).not.toContain("Blade damage");
    expect(shardPickupMessage(6, 9)).toContain("Blade damage +2.");
    expect(shardPickupMessage(7, 9)).not.toContain("Blade damage");
  });

  it("caps the blade bonus so carrying every shard is not the best build", () => {
    // The investigations pay up to +5 on top of this. Without a cap, taking all
    // nine would beat doing any of the reading.
    expect(shardBladeBonus(0)).toBe(0);
    expect(shardBladeBonus(2)).toBe(0);
    expect(shardBladeBonus(3)).toBe(1);
    expect(shardBladeBonus(5)).toBe(1);
    expect(shardBladeBonus(6)).toBe(2);
    expect(shardBladeBonus(9)).toBe(2);
  });

  it("sums the cumulative cost across a full run", () => {
    expect(cumulativeHarvestCost(0)).toBe(0);
    expect(cumulativeHarvestCost(3)).toBe(1);
    expect(cumulativeHarvestCost(6)).toBe(5);
    expect(cumulativeHarvestCost(9)).toBe(13);
  });

  it("composes the ward-unlock message with the ninth shard's price, no doubled spaces", () => {
    const message = wardUnlockMessage(9);
    expect(message.endsWith("Maximum health −3.")).toBe(true);
    expect(message).not.toContain("  ");
  });
});

describe("fortress warden", () => {
  it("records what guarded every shard", () => {
    for (const regionId of Object.keys(FORTRESS_LAYOUTS)) {
      const entry = fortressWardenEntry(regionId);
      expect(entry).not.toBeNull();
      expect(entry?.id).toBe(`warden:${regionId}`);
      expect(entry?.title).toBe("What kept the shard");
      expect(entry?.text.length).toBeGreaterThan(80);
    }
  });

  it("writes nothing for a region with no warden", () => {
    expect(fortressWardenEntry("overworld")).toBeNull();
    expect(fortressWardenEntry("cinderwild")).toBeNull();
  });

  it("preserves the astronomer's established investigation fact after moving it indoors", () => {
    expect(wardenFact("fortress.starfall-watch")).toBe("warden:starfall-moors");
    expect(wardenFact("fortress.cinderwild-watchpost")).toBe("warden:fortress.cinderwild-watchpost");
  });

  it("records an intake docket for every fortress shard", () => {
    for (const regionId of Object.keys(FORTRESS_LAYOUTS)) {
      const entry = fortressShardIntakeEntry(regionId);
      expect(entry).not.toBeNull();
      expect(entry?.id.startsWith("intake:")).toBe(true);
      expect(entry?.title).toContain("Intake Docket");
      expect(entry?.source).toBe("Intake Core Recovery");
      expect(entry?.text.length).toBeGreaterThan(80);
    }
  });

  it("returns null intake docket for non-fortress regions", () => {
    expect(fortressShardIntakeEntry("overworld")).toBeNull();
    expect(fortressShardIntakeEntry("cinderwild")).toBeNull();
  });
});

