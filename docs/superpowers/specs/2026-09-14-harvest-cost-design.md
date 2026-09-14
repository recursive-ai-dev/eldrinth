# The Harvest Cost — Design

**Status:** approved for implementation
**Scope:** sub-project A of the post-narrative work. Milestone 2 (combat and
equipment depth), the character bible and hard-set appearances, and the
additional story work are separate sub-projects and are not specified here.

**Goal:** Put the game's premise into the player's hands. Eldrinth's story
says the nine Anima Shards are nine conscious people and that taking one
kills them; the input says *touch a glowing pickup, gain `+1` max health*.
This makes every harvest cost the player something permanent, so the
arithmetic of the run says what the prose says.

**Spec this builds on:**
`docs/superpowers/specs/2026-09-13-the-harvest-narrative-design.md` — its
§1 canon and §6 escalation schedule are binding here.

---

## 1. The inversion

Today, `engine.ts:872-873` runs on shard pickup:

```typescript
p.maxHp++;
p.hp = Math.min(p.maxHp, p.hp + 2);
```

A shard makes the player stronger and heals them. Both go away. **A shard
grants nothing.** It costs permanent maximum health, on a rising curve.

All character growth now comes from the three investigations and the four
wayfire relics — the optional, story-bearing content. Harvesting itself is
not elective: the ward gates on all nine shards (`MovementSystem` blocks
ward tiles until `wardUnlocked`, which is set only once the ninth shard is
taken), so every player pays the full 13-point cost. The only real choice
is whether to do the investigations and claim the relics that offset it —
a player who engages with that optional content arrives at the Spire able
to fight; a player who skips it arrives hollowed out.

## 2. The curve

| Shard | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Max HP cost | 0 | 0 | 1 | 1 | 1 | 2 | 2 | 3 | 3 |
| Cumulative | 0 | 0 | 1 | 2 | 3 | 5 | 7 | 10 | 13 |

Total cost: **13**.

`PLAYER_START_HP` rises from `6` to **`18`**. `DIFFICULTY_TUNING` stays
additive and untouched, so Story difficulty still starts `+2` (20) and
Standard and Brutal start at 18.

**Endpoints.** The ward gates on all nine shards (`MovementSystem` blocks
ward tiles until `wardUnlocked`, set only once the ninth is taken), so
under the old rules every player reached the boss at the same floor:
`PLAYER_START_HP` (6) + nine harvests at `+1` each = **15** max HP,
minimum. The comparison that matters is therefore 15 → 5, not 6 → 5. A
player who takes nine shards and does nothing optional now reaches the
Spire at **5** max HP. With all three investigations (`+2` and `+3`
health) and the `emberheart` relic (`+2`), they arrive at **12**.

Boss and enemy tuning (`BOSS_HP`, `BOSS_DAMAGE`, `PLAYER_ATTACK_DAMAGE`,
`DIFFICULTY_TUNING`, and every enemy damage constant) are deliberately
left unchanged by this spec. That means the finale becomes attritional for
a bare run that skipped the optional content — arriving at 5 instead of
the old guaranteed 15 is a real difficulty increase at the encounter that
matters most. Whether to retune the fight for that is an open decision,
explicitly out of scope here (§9).

**Why this shape, and not a flat tax.** The narrative spec's §6 escalation
schedule is already implemented in the shard messages and the journal
bleed. It says shards 1–2 are where "nothing is wrong", the investigations
land at 3–5, and 6–8 is where it turns. A flat per-shard cost would make
the HUD contradict the prose on the very first pickup. This curve is free
for the first two shards, starts billing when the investigations land,
doubles at six where the journal already begins recording things the player
did not write, and peaks at the last two. The numbers, the messages and the
journal all turn at the same moment.

## 3. The floor

Maximum health is clamped to a minimum of **1** and can never reach zero.
Current `hp` is clamped to the new `maxHp` after every harvest, so a player
at full health immediately loses the point rather than carrying a current
value above their new maximum.

The floor exists to make the state unrepresentable rather than to be
reachable: 18 − 13 = 5 means it cannot trigger through normal play. It
guards against a future curve edit, not against the shipped one.

## 4. Where the logic lives

A pure function in `src/game/escalation.ts`:

```typescript
shardHarvestCost(count: number): number
```

This module already holds `shardPickupMessage` and `shardBleedEntry`, and
already exists specifically because it imports nothing from `engine.ts` —
no test in this repo can import `engine.ts`, which drags in `renderer.ts`
and the sprite-atlas layer and expects a browser. The cost table belongs
next to the message table it is keyed by, and stays testable under Node.

`engine.ts`'s pickup site consumes it. The existing ward-unlock branch, the
particle burst, the ring effect and the journal-bleed guard are untouched;
only the two stat lines change.

## 5. The HUD

`HUD.tsx:26` currently renders one heart per point of `maxHp`
(`Array.from({ length: hud.maxHp })`). At 18 that row wraps badly at phone
width, and it makes losing a single point visually negligible early —
backwards, since the whole feature is about the loss being felt.

**Replace the heart row with a compact bar**, mirroring the stamina bar
that already sits two elements below it in the same panel (`HUD.tsx:45-54`)
— same rounded track, same fill-width transition, same label-plus-number
header. The header reads current and maximum explicitly:

```
LIFE                    14 / 16
```

so the maximum is on screen at all times and visibly drops at each harvest.
Palette stays the existing heart red (`#e24747` fill, `#ff7a7a` accent)
rather than adopting the stamina cyan, so the bar still reads as health.

The `Heart` component and its SVG are deleted, not left orphaned.

**This is the one piece of the feature the player looks at constantly.** A
number that goes down and never comes back, sitting in the corner for the
whole run, is the mechanic's primary expression.

## 6. Messaging

`SHARD_NOTES` in `escalation.ts` already appends an escalating sentence to
each pickup. Each costed shard also states its price, in the same register
the quest resolutions already use ("Maximum health +2."):

> `Anima Shard recovered (6/9). It was still talking when I closed my hand. Maximum health −2.`

Shards 1 and 2 cost nothing and say nothing about cost — they keep their
current text exactly. The first time the player ever sees a price is shard
three.

The journal bleed at shards 6, 7 and 8 is unchanged.

## 7. Saves

**Revised.** This section originally argued for no migration and no version
bump, on the theory that an untouched carried save would be "strictly
generous" relative to a fresh run. That was wrong: the old rule banked
`+1` max health per shard *already taken*, while the new rule bills per
shard *still remaining*. Left untouched, a carried save pays the new costs
against its old, lower `maxHp` and gets floored at 1 — permanent one-shot
death against a boss that deals more than that — rather than treated
generously. The same root cause made the floor non-commutative, rewarding
players who harvested before resolving quests.

The snapshot is now `version: 4`. Restoring a `version <= 3` snapshot
applies a delta migration: `maxHp += 12 - shards - cumulativeHarvestCost(shards)`,
then `hp` is clamped to the new `maxHp`. This lands every shard count
exactly on the fresh-rules target (0 shards → 18, 3 → 17, 6 → 13, 9 → 5)
without recomputing `maxHp` from scratch, so quest and relic bonuses —
folded into the same field and not tracked separately — survive untouched
as the separate addend they always were.

## 8. Testing

- `escalation.test.ts` — `shardHarvestCost` returns the exact table in §2
  for 1–9; shards 1 and 2 cost 0; the cumulative total is 13; counts
  outside 1–9 return 0 rather than throwing.
- A harvest test — taking a shard reduces `maxHp` by the curve's amount,
  clamps `hp` to the new maximum, and never drops `maxHp` below 1.
- `shardPickupMessage` — messages for shards 3–9 state the cost; messages
  for 1–2 do not; every message still carries its `(n/9)` count.
- `WorldState.test.ts` — a `version <= 3` snapshot restores with `maxHp`
  adjusted onto the §7 migration target and `hp` clamped to it, while
  `quests.resolutions` and `journal` survive untouched.
- Full suite green (124 at time of writing), `tsc --noEmit` clean, and a
  headless playthrough confirming the bar renders, drops on a costed
  harvest, and does not wrap at 400px width.

## 9. Explicitly out of scope

Combat and equipment depth (Milestone 2), relic slots and active tools, the
character bible, hard-set sprite appearances, additional story content, the
visceral layer, enemy rebalancing, and any change to the three
investigations' rewards.
