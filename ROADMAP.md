# Eldrinth development roadmap

Eldrinth will be a compact action RPG built around self-directed discovery. The player learns routes, threats, and motives from landmarks, witnesses, and a personal field journal. The journal preserves knowledge; it does not turn discoveries into map pins or a checklist.

## Milestone 1 — A journey worth following (implemented)

The first complete playable arc now has four connected regions: the Old Lands, Cinderwild, Moonlit Coast, and Starfall Moors. Nine shards are placed across those lands, and road signs provide directional, landmark-based information for finding them. Taking a shard is no longer a reward: each one now costs the pilgrim permanent maximum health on a rising curve, free for the first two and steeper from the sixth on, so the run's felt cost lands with the same weight as the story's. Character growth instead comes from the investigations and the relics they yield, not from the shards themselves.

Four investigations run alongside the main pilgrimage, and each one is an account of institutional violence read straight off the paperwork:

- **The Courier Who Never Came:** a courier's orders in Ilyarael, read against a still-conscious child sealed inside the vessel she refused to deliver at the Cinderwild shrine.
- **Names the Tide Kept:** an evacuation ledger at the salt graves that quietly reclassifies the people left behind as intake, read against the keeper's own signed confession at the coastal beacon.
- **A Borrowed Dawn:** a Starfall observatory's working notes on a self-administered intake prototype, read against its inventor, still conscious inside the guardian shell he built.
- **The Shape of the Pilgrim:** Barris the smith's reading of what the player is, held against the vault's intake record. A fourth file the milestone-1 text above did not list; it shipped anyway.

Discoveries can be made in any order. Once enough evidence is brought back to Orithel, the player chooses the outcome and receives one permanent, saveable reward — every choice folds a still-conscious person into the player's own equipment or extinguishes them outright; there is no option that costs nothing. The journal also accepts player-written observations. Region inhabitants, collected shards, quest decisions, wayfire checkpoints, relics, and notes survive saving, refreshes, deaths, and return trips.

## Milestone 2 — Make each expedition play differently

Add small, authored activity sites to each region: a hazardous crossing, a combat arena, a hidden refuge, and one optional encounter with a unique rule. Each site should offer a clue, material, or relationship rather than generic loot.

All nine shards now sit inside their own enterable fortresses rather than in open-field clearings. Each fortress has a distinct 26×19 authored layout, its own gate and return route, no wayfire to rest at, darkness, ember hazards, a warden, and a journal record of what was guarding the vessel. Dying inside resets that fortress's enemies rather than the run itself. It does **not** put a shard back: taking one is recorded against the vessel, not the pickup, so a retry cannot re-award it. The harvest cost is billed once per person, permanently.

Frontier and overworld maps are expanded to 200×140 tiles, making the expedition across the continent feel earned: each fortress commands an authored exterior facade, distinct regional hazards (ember-filled ravines, sea cliffs, celestial impact craters), and strategic perimeter guards, ensuring reaching a fortress gate is a memorable journey.

Four regional settlements (Ilyarael Township, Cinder Haven, Oarsman's Bight, and Crater Watch) now offer refuge, healers, and oral histories. Every fortress shard has its own historical intake docket and trapped conscious persona recorded in the player's journal when harvested.

Build a light equipment layer around meaningful tradeoffs: two active tools and three relic slots, with effects that change play patterns such as projectile-deflecting dashes, a slower heavy strike, or a lantern that reveals concealed messages. Expand enemy telegraphs and give each region one elite behavior that changes how the player uses space.

**Not shipped in v1.** The equipment layer, the per-region elite behaviours, and the four
authored activity sites above are designed but not implemented. What v1 does have is telegraphed
enemy specials (`AISystem` `spell` / `lunge` / `burst` wind-ups) and a wayfire relic that grants
one of four stat bonuses. Wayfire relics are bookkeeping in `player.relics` used to prevent
duplicate grants; they are not rendered, equipped, or read by the HUD. Treat the paragraph above as
a specification, not a changelog entry.

## Milestone 3 — Turn knowledge into mastery

Add New Pilgrimage mode with a seed shown in the journal, optional challenge vows, completion records, and alternate route conditions.

**Not shipped in v1, and not required by the main story.** The arc is complete and finishable
without it. One item from this milestone *is* load-bearing and did ship: the epilogue. A fully
investigated run now gets a closing account of what it actually did, which choices it made, which
town requests it completed, how many wardens it identified, and how many times it died — assembled
by `epilogueLines()` in `src/game/epilogue.ts`. Reaching the Spire short of nine also offers a
deliberate turn-back, so a run can be stopped rather than only abandoned.

What remains here is the NG+ system proper: a seed shown in the journal, self-chosen vows that
actually gate gameplay, completion records, and alternate route conditions.

## Production bar

Keep the browser-only build, with the old single-file constraint deliberately dropped so real sprite and tile atlases can ship as image assets (see the procedural sprite pipeline design spec). Every saveable gameplay change needs a deterministic state test, and every new landmark needs a visible in-world silhouette, a journal record, and directions expressed through geography rather than coordinates or markers. Performance work focuses on stable frame times during boss patterns and clean recovery from tab suspension or a failed region load.

Content rating is a hard M. The full story now reads as institutional atrocity told in flat clerical language — the machine at the world's heart is built out of living minds, the nine shards are nine people still conscious inside it, and the game states this plainly rather than softening it. A content warning gates first launch (and only first launch; it is not shown again once acknowledged) and discloses institutional violence and the killing of children. Nothing in the approved copy is decorative shock — it is load-bearing to the premise — and it should not be walked back in future work without a deliberate decision to do so.
