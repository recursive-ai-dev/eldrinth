# The Harvest Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make taking an Anima Shard cost the player permanent maximum
health on a rising curve, instead of granting it, so the arithmetic of a run
says what the story says.

**Architecture:** All of the logic — the cost table, the floor, the clamp
and the message suffix — goes into `src/game/escalation.ts` as pure
functions, because no test in this repo can import `engine.ts` (it pulls in
`renderer.ts` and the sprite-atlas layer, which expect a browser).
`engine.ts` becomes a thin caller. The HUD's heart row is replaced by a
compact life bar so the falling maximum is visible at a glance.

**Tech Stack:** TypeScript, React 19, Zustand, Vite, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-14-harvest-cost-design.md`

## Global Constraints

- **The cost curve is exactly `0,0,1,1,1,2,2,3,3` for shards 1-9**, total 13.
- **`PLAYER_START_HP` becomes `18`** (from `6`). `DIFFICULTY_TUNING` stays
  additive and untouched, so Story still starts `+2`.
- **Maximum health is floored at 1** and can never reach zero.
- **Shards 1 and 2 cost nothing and must say nothing about cost** — their
  existing messages stay byte-identical.
- The cost sentence is `Maximum health −N.` using **U+2212 MINUS SIGN
  (`−`)**, not an ASCII hyphen. This matches the spec and the typography of
  the existing quest-resolution copy.
- A shard grants nothing: no max-health gain, no heal.
- **No snapshot migration and no version bump.** The snapshot stays at
  `version: 3`.
- Run `npx vitest run` and `npx tsc --noEmit` before every commit.

---

### Task 1: The cost curve, the floor, and the message suffix

Everything pure, in one module, with one test file. These four functions are
the whole feature's logic; Tasks 2 and 3 only wire them up.

**Files:**
- Modify: `src/game/escalation.ts`
- Test: `src/game/escalation.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, all exported from `src/game/escalation.ts`:
  - `shardHarvestCost(count: number): number`
  - `shardCostSuffix(count: number): string`
  - `applyHarvestCost(maxHp: number, hp: number, count: number): { maxHp: number; hp: number }`
  - `shardPickupMessage(count, total)` keeps its existing signature; its
    output gains the cost suffix for shards 3-9.

- [ ] **Step 1: Write the failing tests**

Add to `src/game/escalation.test.ts`:

```typescript
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
```

Note the `−` characters above are U+2212, not hyphens. Copy them verbatim.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/escalation.test.ts`
Expected: FAIL — `shardHarvestCost`, `shardCostSuffix` and
`applyHarvestCost` are not exported.

- [ ] **Step 3: Implement the four functions**

In `src/game/escalation.ts`, add below the existing `SHARD_NOTES` block and
`shardPickupMessage`:

```typescript
/**
 * What each shard costs in permanent maximum health. Free for the first two
 * so the HUD agrees with the prose that nothing is wrong yet; billing starts
 * where the investigations land and doubles at six, where the journal bleed
 * already begins. Thirteen across a full run.
 */
const SHARD_HARVEST_COST: Record<number, number> = {
  3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 3, 9: 3,
};

export function shardHarvestCost(count: number): number {
  return SHARD_HARVEST_COST[count] ?? 0;
}

/** The price, stated in the register the quest resolutions already use. */
export function shardCostSuffix(count: number): string {
  const cost = shardHarvestCost(count);
  return cost > 0 ? ` Maximum health −${cost}.` : "";
}

/**
 * The whole stat mutation of a harvest, in one pure place: spend the cost,
 * never fall below one, and pull current health down to the new ceiling
 * without healing a wounded player.
 */
export function applyHarvestCost(maxHp: number, hp: number, count: number): { maxHp: number; hp: number } {
  const nextMax = Math.max(1, maxHp - shardHarvestCost(count));
  return { maxHp: nextMax, hp: Math.min(hp, nextMax) };
}
```

- [ ] **Step 4: Append the suffix to the pickup message**

Change `shardPickupMessage` so the price rides along:

```typescript
export function shardPickupMessage(count: number, total: number): string {
  return `Anima Shard recovered (${count}/${total}).${SHARD_NOTES[count] ?? ""}${shardCostSuffix(count)}`;
}
```

`shardCostSuffix` must be defined above this function, or hoisting rules
will bite — function declarations hoist, but keep the reading order sane.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. The three pre-existing `shardPickupMessage` tests still
pass unchanged — shards 1 and 2 get an empty suffix, and the
`toContain("still talking")` assertion is unaffected by an appended
sentence.

- [ ] **Step 6: Commit**

```bash
git add src/game/escalation.ts src/game/escalation.test.ts
git commit -m "Add the harvest cost curve, floor and price messaging

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Charge the player at the harvest

**Files:**
- Modify: `src/game/engine.ts` — the `PLAYER_START_HP` constant, the shard
  branch of the item-pickup loop, and the ward-unlock message.

**Interfaces:**
- Consumes: `applyHarvestCost`, `shardCostSuffix` and `shardPickupMessage`
  from Task 1.
- Produces: nothing later tasks import.

**Locate by content, not by line number.** Search for the quoted code — this
file is over 1300 lines and has been edited by many tasks, so any line
number in this plan is a hint at best.

- [ ] **Step 1: Raise the starting maximum health**

Find `const PLAYER_START_HP = 6;` near the top of `src/game/engine.ts` and
change it to:

```typescript
const PLAYER_START_HP = 18;
```

Leave `DIFFICULTY_TUNING` completely alone. It adds `playerHealth: 2` on
Story and `0` elsewhere, so Story starts at 20 and the others at 18, which
is the intended behaviour.

- [ ] **Step 2: Import the new helpers**

Find the existing import of `./escalation` and extend it:

```typescript
import { applyHarvestCost, shardBleedEntry, shardCostSuffix, shardPickupMessage } from "./escalation";
```

- [ ] **Step 3: Replace the reward with the cost**

In the item-pickup loop, find these two lines inside the
`if (it.type === "shard")` branch:

```typescript
          p.maxHp++;
          p.hp = Math.min(p.maxHp, p.hp + 2);
```

Replace them with:

```typescript
          const harvested = applyHarvestCost(p.maxHp, p.hp, this.shards);
          p.maxHp = harvested.maxHp;
          p.hp = harvested.hp;
```

`this.shards` has already been incremented by the `this.shards++` line
directly above, so it is the 1-based index of the shard just taken — which
is exactly what the cost table is keyed by. Do not add or subtract one.

- [ ] **Step 4: Announce the ninth shard's price**

The ninth shard never reaches `shardPickupMessage`, because the
ward-unlock branch takes over and posts its own message — so without this
step the largest single charge in the game happens silently.

Find the ward message:

```typescript
            this.msg("The ward gives. Nine. It was always going to be nine, and now I know who picked the number.");
```

Replace it with:

```typescript
            this.msg(`The ward gives. Nine. It was always going to be nine, and now I know who picked the number.${shardCostSuffix(this.shards)}`);
```

- [ ] **Step 5: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/engine.ts
git commit -m "Charge permanent maximum health for every shard harvested

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Replace the heart row with a life bar

Eighteen hearts wrap badly at phone width and make a single point's loss
invisible. The bar puts the falling maximum on screen permanently.

**Files:**
- Modify: `src/components/HUD.tsx`

**Interfaces:**
- Consumes: `HudData.hp` and `HudData.maxHp`, both of which already exist in
  `src/game/types.ts` — no type change is needed.
- Produces: nothing later tasks import.

- [ ] **Step 1: Delete the Heart component**

Remove the entire `function Heart({ filled }: { filled: boolean })`
declaration and its SVG from the top of `src/components/HUD.tsx`. It has no
other callers; leaving it would be dead code.

- [ ] **Step 2: Remove the hearts array**

Inside `export default function HUD({ hud }: { hud: HudData })`, delete:

```typescript
  const hearts = Array.from({ length: hud.maxHp });
```

- [ ] **Step 3: Replace the heart panel with the life bar**

Find the panel that maps over `hearts`:

```tsx
        <div className="flex flex-wrap gap-1 rounded-lg border border-amber-200/15 bg-black/45 px-3 py-2 backdrop-blur-sm">
          {hearts.map((_, i) => (
            <Heart key={i} filled={i < hud.hp} />
          ))}
        </div>
```

Replace it with a bar built on the same skeleton as the stamina bar further
down the same panel, so the two read as a set — same rounded track, same
fill transition, same label-and-number header — but in the existing heart
red rather than the stamina cyan:

```tsx
        <div className="w-44 rounded-lg border border-rose-300/20 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between font-title text-[10px] uppercase tracking-[0.2em] text-rose-100/75">
            <span>Life</span>
            <span>
              {Math.max(0, Math.ceil(hud.hp))}
              <span className="text-rose-200/45"> / {hud.maxHp}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-rose-950/80">
            <div
              className="h-full bg-[#e24747] transition-[width] duration-100 ease-out"
              style={{ width: `${hud.maxHp > 0 ? Math.round((Math.max(0, hud.hp) / hud.maxHp) * 100) : 0}%` }}
            />
          </div>
        </div>
```

The `hud.maxHp > 0` guard prevents a division by zero producing `NaN` in the
width string if max health is ever zero. Task 1's floor should make that
impossible, but a HUD must not be the thing that crashes on bad state.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. In particular there must be no "declared but never
read" error for a leftover `Heart` or `hearts`.

- [ ] **Step 5: Commit**

```bash
git add src/components/HUD.tsx
git commit -m "Replace the heart row with a life bar that shows the falling maximum

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Verification and playthrough

**Files:** none (verification only), except `ROADMAP.md` in Step 5.

- [ ] **Step 1: Full suite, types, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 2: Confirm the reward is really gone**

Run:

```bash
grep -n "p.maxHp++\|maxHp + 1" src/game/engine.ts || echo "clean"
```

Expected: `clean`. Any hit means a path still grants max health on pickup.

- [ ] **Step 3: Confirm no orphaned heart code**

Run:

```bash
grep -rn "Heart\|hearts" src/components/HUD.tsx || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Headless playthrough**

Playwright and a headless Chromium are already installed at
`/tmp/claude-1000/-home-damien-Projects-eldrinth/5b65634e-297c-45ff-a019-5d7fc4b1ee58/scratchpad/node_modules`
— **do not reinstall them.** Write the driver script into that directory and
run it from there so the import resolves; `drive.mjs` in that directory is a
working example to adapt. Launch with
`chromium.launch({ args: ['--no-sandbox'] })`.

Start the dev server with `npm run dev` in the background and poll
`http://localhost:5173` until it answers — do not `sleep` a fixed amount.
Stop it afterwards with `lsof -ti:5173 -sTCP:LISTEN | xargs -r kill`; never
a broad `pkill`.

Screen flow: content warning → title → Enter → intro (Escape skips) → game.

Confirm and screenshot:
1. The life bar renders at the top-left and reads `18 / 18` on a fresh
   Standard run.
2. At 400px viewport width the bar does not wrap or overflow the panel.
3. The bar's fill shrinks when the player takes damage.
4. `console --errors` reports nothing.

Reaching a shard on foot is slow. Driving the engine directly to verify the
harvest is acceptable — a previous task in this repo exposed the `Game`
instance on `window` temporarily for exactly this and reverted it before
committing. If you do that, revert it before Step 6 and say so in your
report. Confirm that taking shard 3 drops max health by 1 and that the
message ends `Maximum health −1.`

- [ ] **Step 5: Update the roadmap**

`ROADMAP.md`'s Milestone 1 section describes shards as the spine of the
pilgrimage but says nothing about what taking one costs. Add a sentence to
that section recording that each shard now costs permanent maximum health on
a rising curve, and that character growth comes from the investigations and
relics rather than from the shards themselves.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Verify the harvest cost and record it in the roadmap

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
