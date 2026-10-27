# The Harvest — Narrative Rewrite Design

> Narrative revision (2026-10-27): child killing and child harvesting are excluded. All harvested people are adults; Roryn is an adult wagoner. Historical child-victim material below is superseded and must not be reintroduced. See current source and ROADMAP.md.

**Status:** approved for implementation
**Scope:** sub-project 1 of 3 (narrative). Sub-project 2 is the visceral
layer (blood, corpses, gore); sub-project 3 is the sprite readability pass.
Neither is specified here.

**Goal:** Rewrite Eldrinth's premise and every line of text in the game so
that the acts the player has always performed — gathering nine shards,
killing the sleeping thing — become atrocities they are committing, not
services they are rendering. No new art. No new combat systems.

**Content rating:** hard M. Full profanity, graphic description of
institutional violence, one explicitly flagged reference to sexual violence
(§7.3). Unflinching but never gratuitous: cruelty is described so it lands,
never staged for enjoyment.

---

## 1. Canon

These facts are the spine. Every rewritten line must be consistent with
them. Nothing here is stated outright to the player before §6.

**The intake.** Facing extinction in the Sundering, the Elder Elves set out
to build a mind that would lose nothing. A mind cannot be grown, only taken.
So they built an intake and fed it living minds — prisoners first, then the
poor, then, when those ran out, their own children. The Mnemonic Engine is
made of people. Every one of them is still in it, awake.

**The Unbound.** Not a god dreaming. Nine hundred years of murdered people
who were never permitted to finish dying, screaming in chorus. It is not
malevolent. It is in pain.

**The Sundered.** The enemies the player has been killing all game are
fragments of that scream that got loose and kept a shape. They are not
monsters. They are pieces of people, and they are hostile because they are
in agony.

**The nine shards.** Nine cores — nine individuals, load-bearing in the
Engine's architecture, conscious for the entire nine hundred years. Prying
one loose kills them, finally and properly, and the light gained is what is
left of a person. **The HUD's `ANIMA 0 / 9` is a body count and always
was.**

**Orithel.** Not the Watcher. Orithel the Architect — the man who designed
the intake and wrote the vocabulary that laundered it. He survived by
copying himself into the Engine badly and is a partial. Nine cores is the
dose he needs to reconstitute a body.

**The player.** A vessel, grown from the courier's recovered pattern because
she was the only one who ever reached the Spire. Not the first. Gathers, is
spent, is regrown. The intro's existing exchange — *"I don't remember coming
before." / "You never do."* — is literal and now load-bearing.

**The wayfires.** Not checkpoints. Collection points, where Orithel reads
what the vessel carries and takes his copy. Resting is submitting. This is
never stated; it is implied by wayfire text and confirmed in §6.

---

## 2. Voice

Four registers. Each text site in §5 is assigned one.

**2.1 Orithel — administrative.** Never cruel, never raised, never profane.
He does not deny what happened; he uses the vocabulary that was built to
make it sayable. `intake`, `yield`, `reconciliation of the rolls`,
`the program`, `units`, `permitted wastage`. His warmth is genuine, which is
why it works. He is the only character who never swears, and that restraint
is the tell.

> "You will find the ninth difficult. She has had longer than the others to
> become someone. That is the usual complication and it resolves itself
> under pressure."

**2.2 The record — bureaucratic.** Ledgers, orders, rolls, beacon logs.
Flat, procedural, and all the worse for it. Atrocity as line items. Never
editorialises. The horror is that nobody writing it thought they were
writing anything unusual.

> RECONCILED — 41. TRANSFERRED TO COLLECTION — 39. Remainder, being
> already struck, were not counted out.

**2.3 The witnesses — profane, exhausted.** The courier's marginalia, the
beacon keeper's confession, the astronomer's last words. These are people
under sustained duress and they talk like it. This is where the profanity
lives, and it should be load-bearing rather than decorative — a person
swears because the polite words have run out.

> "I have read the orders four times looking for the part where this is
> something other than what it fucking is. It isn't there. It was never
> going to be there."

**2.4 The player's journal — first person, deteriorating.** Starts clipped
and practical. As shards accumulate, the entries get worse: shorter,
repetitive, occasionally recording something the player does not remember
writing. By the ninth, the handwriting is the courier's.

---

## 3. The three investigations

`quests.ts`'s structure does not change. Same `QuestDefinition` shape, same
`fact` IDs, same `reward` stat/amount pairs — only `title`, `lead`,
`evidence[].text`, and `choices[].label`/`.text` are rewritten. The one
exception is the courier's third choice (§3.1).

### 3.1 The Courier Who Never Came

**Facts:** `courier-orders`, `courier-memory` (unchanged).

She was ordered to carry an intake vessel containing a harvested child to
the shrine. She heard it speak, refused, went there intending to destroy it,
and could not. She burned herself out sheltering it instead. What the player
finds is the child — nine centuries awake, no body, no way to stop being
awake.

**Choices.** The existing two are kept and poisoned; a third is added.

| id | label | what it actually is | reward |
|---|---|---|---|
| `release` | Give the child to the wayfires | Orithel eats it | health +2 |
| `bind` | Bind the child to my blade | A child used as a weapon | blade +1 |
| `end` | End it. Take nothing. | The only mercy; costs the player | none |

`end` is the first choice in the game that returns no mechanical reward.
That is the point and it must not be softened with a hidden bonus.

**Implementation note:** `resolveQuest` and the `reward` type must tolerate
a choice with no reward. Prefer `reward?: {...}` over a sentinel amount of
zero, so a rewardless choice is unrepresentable-as-a-bug rather than a
magic number.

### 3.2 Names the Tide Kept

**Facts:** `salt-graves`, `salt-beacon` (unchanged).

The "infection" mark in the ledger was the intake mark. The keeper was not
concealing anyone's heroism — he was the selector. The last boat left half
empty because he had already sold the other half to the collectors, and he
doctored the rolls so no family would ever come asking after them.

His beacon confession must be **persuasive**. He explains, calmly and in
good faith, why it was the correct decision, and a reader who is not paying
attention will find themselves agreeing. That is the trap and the whole
purpose of the site.

**Choices.** Both existing choices kept, rewritten:
- `remember` (stamina +25) — publish the rolls. The families learn exactly
  what was done, and that the keeper is nine centuries beyond any punishment.
- `mercy` (dash −5) — bury it. The lie holds, and the player learns the
  keeper's own trick of making a person vanish from a record. The label must
  no longer read as kindness.

### 3.3 A Borrowed Dawn

**Facts:** `dawn-record`, `warden:starfall-moors` (unchanged).

The lens was never built to catch the sun. It was an intake prototype. The
astronomer tested it on himself to prove the process was survivable so the
program could scale. It was not survivable. He has been conscious inside a
warden's shell ever since, on a loop, killing everyone who walks the eastern
road, aware of it the whole time.

When the shell breaks, what is inside thanks the player — and then asks
whether the program went ahead anyway. **The player has no dialogue option
to answer.**

**Choices.** Both kept. `kindle` (health +3) takes him into the player's
body; `temper` (blade +1) makes him into an edge. Both are using him again,
and the resolution text must make that plain without stating it.

---

## 4. Endings

### 4.1 The three endings

| id | title | what happens |
|---|---|---|
| `silence` | THE SPIRE FALLS SILENT | The player breaks the Unbound. Nine hundred years of people die at once — the largest killing in the world's history. Orithel reconstitutes and walks out wearing the player's pattern. |
| `refusal` | THE SPIRE HEARS YOU | At the ward, holding nine, the player declines to hand them over. Not a victory. The Unbound hears a vessel refuse for the first time, and something happens that the game does not explain. The title deliberately mirrors `silence`'s cadence. |
| `spent` | YOUR LIGHT FADES | The player does not die. They are recycled. It has happened before and will happen again. |

**`silence` keeps its existing title text verbatim.** The entire effect
depends on that line — triumphant, beautiful, already in the game — now
reading as obscene. The screen stays beautiful; the prose underneath does
the damage. Do not make the art grim to signal the tone.

**`spent` keeps its existing title text verbatim** for the same reason, with
rewritten body copy. The save slot is the in-fiction tally of how many times
this has happened, and the text should point at it.

### 4.2 The refusal trigger

Today, `engine.ts:775-778` spawns the boss the moment the player with
`wardUnlocked` comes within `TILE * 5` of `map.bossCenter`. That becomes a
dialogue gate instead:

1. Player approaches `bossCenter` with `wardUnlocked === true` and
   `bossSpawned === false`.
2. Orithel opens a dialogue with two choices (reusing `openDialogue` /
   `chooseDialogue`, exactly as quests already do — no new UI).
3. `ending:surrender` → `spawnBoss()`, the existing path, unchanged. Beating
   the boss produces `silence`.
4. `ending:refuse` → ends the run with `refusal`. No combat.

This adds no new enemy archetype, no sprite, and no AI. It is the reason
refusal ships in this sub-project rather than waiting on art.

**The dialogue must be re-openable.** If the player walks away and returns,
they get it again — it must not be consumed on first read and leave the ward
in a state with no way forward.

### 4.3 Replacing the win/lose binary

The binary is assumed in 8 places (`App.tsx:98,99,145,146`,
`types.ts:99,100`, `EndScreen.tsx:8,11`, `SceneStack.ts:1`,
`useGameStore.ts:22,77,79`, `GameCanvas.tsx:31,32`, `engine.ts:713,1227`).

Replace it rather than bolting a third case onto it:

- `SceneStack.ts` — `SceneId` loses `"win" | "lose"` and gains `"ending"`.
- New `EndingId = "silence" | "refusal" | "spent"` (co-locate with
  `SceneId`).
- `useGameStore` — `endGame(ending: EndingId)` pushes the single `"ending"`
  scene and records `ending` in state; add an `selectEnding` selector
  alongside the existing `selectScreen`.
- `types.ts` `GameCallbacks` — `onWin`/`onLose` collapse into
  `onEnd(ending: EndingId)`. `GameCanvas.tsx` forwards it.
- `engine.ts:713` → `onEnd("spent")`; `:1227` → `onEnd("silence")`; the new
  refusal branch → `onEnd("refusal")`.
- `EndScreen.tsx` — takes `ending: EndingId`, not `variant`. Its current
  `win`-vs-`lose` styling generalises to a per-ending record of
  title/body/palette. `refusal` gets its own palette; it should look like
  neither of the other two.

`SceneStack.test.ts` and any store test referencing `"win"`/`"lose"` are
updated as part of this.

---

## 5. Text site inventory

Every site that must be rewritten, with its assigned register from §2.

| Site | Location | Register |
|---|---|---|
| Intro shots 0–5 | `IntroSequence.tsx:80-140` | 2.2 / 2.3 |
| `MEMORY_WORDS` | `IntroSequence.tsx:6` | 2.2 |
| `ORITHEL_LINES` (8 lines) | `engine.ts:120-128` | 2.1 |
| Orithel hub + quest dialogue | `engine.ts:1060,1096,1115` | 2.1 |
| Old Lands signs (11) | `map.ts:236-257` | 2.2 / 2.3 |
| Frontier road signs | `map.ts:358` | 2.2 |
| Region surveys (3) | `map.ts:361-364` | 2.2 |
| Region records (6) | `map.ts:366-378` | 2.2 / 2.3 |
| Quest leads, evidence, choices | `quests.ts:17-52` | 2.1 / 2.2 / 2.3 |
| HUD objectives (5) | `GameFlowSystem.ts:29-35` | 2.4 |
| Interaction prompts | `GameFlowSystem.ts:57-70` | 2.4 |
| Shard pickup / ward messages | `engine.ts:875-883` | 2.4 |
| Wayfire rest text | `engine.ts:1192` | 2.1 |
| Ending screens (3) | `EndScreen.tsx:40-46` | 2.4 |

**The intro keeps shot 4 verbatim.** *"You have come for the nine pieces." /
"I don't remember coming before." / "You never do."* and **THE NINTH MEMORY
IS NOT MINE** are already correct for the new canon and must not be touched.
Shots 1–3 are rewritten so that "The Kindness" reads as the lie the
Architects told themselves.

---

## 6. Escalation schedule

The canon in §1 is not delivered as a twist. It is available to a player who
reads, from the first sign, and inescapable by the end.

- **0–2 shards.** Nothing is wrong. Orithel is kind and the world is sad.
  The only discordant notes are in the record register: vocabulary that
  doesn't fit a tragedy (`intake`, `yield`, `rolls`).
- **3–5 shards.** The investigations land. Each one independently
  establishes that an institution did this deliberately. Orithel's
  explanations remain plausible and are now doing visible work.
- **6–8 shards.** The journal (2.4) starts recording things the player did
  not write. Shard pickup text stops being triumphant. At least one shard
  is taken from something that is still talking.
- **9 / the ward.** Orithel drops the register entirely — not into cruelty,
  into *procedure*. He is not a monster revealed; he is a man finishing a
  job, and he is grateful to the player, sincerely.

---

## 7. Content boundaries

### 7.1 Profanity
Present and load-bearing in register 2.3 and in the player's journal.
Orithel never swears (§2.1). Profanity marks the characters who have run
out of polite words; using it for texture everywhere would waste it.

### 7.2 Violence
Described plainly, in institutional vocabulary. The horror is bureaucratic:
what was done is less disturbing than the fact that it was scheduled,
costed, and filed. No lingering physical detail for its own sake — the
visceral layer is sub-project 2's job and belongs on screen, not in prose.

### 7.3 ⚠️ Sexual violence — one line, explicitly bounded

The salt-graves ledger carries a single marginal note recording what the
collectors were permitted to do with people already struck from the rolls,
on the stated logic that someone who does not exist cannot be a victim.

Constraints, all binding:
- **One occurrence**, in the ledger, in register 2.2 (bureaucratic).
- **No physical detail whatsoever.** The line records a permission, not an
  act. Its horror is entirely in the administrative framing.
- **Never referenced again** anywhere else in the game — not in the beacon
  confession, not by Orithel, not in a resolution, not as flavour.
- **No character comments on it.** No moral is drawn for the player.

This was raised before approval and approved deliberately. Cutting it
requires no other change to this spec: the collectors' cruelty is
independently established by the sale of the passengers.

### 7.4 Content warning

**Required.** A first-launch content warning screen before the title screen,
naming institutional violence, child death, and sexual violence, with an
acknowledgement to proceed. Dismissal persists in `localStorage` and does
not gate replays. This is not optional at this rating.

---

## 8. Testing

- `quests.test.ts` — the new `end` choice resolves, is recorded in
  `resolutions`, and applies no reward; the two rewarded courier choices
  still apply theirs. Optional `reward` is honoured.
- New ending test — each of the three `EndingId`s reaches `EndScreen` with
  the right copy; `refusal` is reachable only with `wardUnlocked`.
- `GameFlowSystem.test.ts` — objective strings updated to the new copy.
- `SceneStack.test.ts` — updated for `"ending"` replacing `"win"`/`"lose"`.
- A save-round-trip test covering a run that resolved the courier with
  `end`, confirming a rewardless resolution survives save/load.
- Full suite (currently 102 tests) green, `tsc --noEmit` clean, and a
  headless-browser playthrough as in the sprite pipeline's Task 14 — reach
  the ward, confirm both branches of the refusal dialogue, confirm the
  content warning shows once.

## 9. Explicitly out of scope

Blood, decals, corpses, gore, shard-extraction feedback, boss damage
states, sprite palette work, new enemy archetypes, an Orithel boss fight,
new regions, new map geometry, and any change to combat balance.
