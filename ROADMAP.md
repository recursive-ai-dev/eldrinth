# Eldrinth development roadmap

Eldrinth will be a compact action RPG built around self-directed discovery. The player learns routes, threats, and motives from landmarks, witnesses, and a personal field journal. The journal preserves knowledge; it does not turn discoveries into map pins or a checklist.

## Milestone 1 — A journey worth following (implemented)

The first complete playable arc now has four connected regions: the Old Lands, Cinderwild, Moonlit Coast, and Starfall Moors. Nine shards are placed across those lands, and road signs provide directional, landmark-based information for finding them. Taking a shard is no longer a reward: each one now costs the pilgrim permanent maximum health on a rising curve, free for the first two and steeper from the sixth on, so the run's felt cost lands with the same weight as the story's. Character growth instead comes from the investigations and the relics they yield, not from the shards themselves.

Four investigations run alongside the main pilgrimage, and each one is an account of institutional violence read straight off the paperwork:

- **The Courier Who Never Came:** a courier's orders in Ilyarael, read against a still-conscious adult wagoner sealed inside the vessel she refused to deliver at the Cinderwild shrine.
- **Names the Tide Kept:** an evacuation ledger at the salt graves that quietly reclassifies the people left behind as intake, read against the keeper's own signed confession at the coastal beacon.
- **A Borrowed Dawn:** a Starfall observatory's working notes on a self-administered intake prototype, read against its inventor, still conscious inside the guardian shell he built.
- **The Shape of the Pilgrim:** Barris the smith's reading of what the player is, held against the vault's intake record. A fourth file the milestone-1 text above did not list; it shipped anyway.

Discoveries can be made in any order. Once enough evidence is brought back to Orithel, the player chooses the outcome and receives one permanent, saveable reward — every choice folds a still-conscious person into the player's own equipment or extinguishes them outright; there is no option that costs nothing. The journal also accepts player-written observations. Region inhabitants, collected shards, quest decisions, wayfire checkpoints, relics, and notes survive saving, refreshes, deaths, and return trips.

## Milestone 2 — Make each expedition play differently (partly implemented in 1.1)

Four optional authored sites now extend the frontier: the Hollow of the Uncounted in the Old Lands, Ashglass Causeway in Cinderwild, the Drowned Court on the Moonlit Coast, and the Listening Ring in Starfall Moors. They offer a hidden refuge, a hazardous crossing, a combat arena, and an encounter with its own rule. Each has geographic directions, a journal record and a permanent reward that cannot be collected twice. Existing saves can discover the new sites.

All nine shards now sit inside their own enterable fortresses rather than in open-field clearings. Each fortress has a distinct 26×19 authored layout, its own gate and return route, no wayfire to rest at, darkness, ember hazards, a warden, and a journal record of what was guarding the vessel. Dying inside resets that fortress's enemies rather than the run itself. It does **not** put a shard back: taking one is recorded against the vessel, not the pickup, so a retry cannot re-award it. The harvest cost is billed once per person, permanently.

Frontier and overworld maps are expanded to 200×140 tiles, making the expedition across the continent feel earned: each fortress commands an authored exterior facade, distinct regional hazards (ember-filled ravines, sea cliffs, celestial impact craters), and strategic perimeter guards, ensuring reaching a fortress gate is a memorable journey.

Four regional settlements (Ilyarael Township, Cinder Haven, Oarsman's Bight, and Crater Watch) now offer refuge, healers, and oral histories. Every fortress shard has its own historical intake docket and trapped conscious persona recorded in the player's journal when harvested.

The equipment layer ships in 1.1: a fast Wayblade, a slower Gravehammer with a stamina cost, and three relic slots. Attuned relics can absorb hit damage, deflect projectiles during a dash, accelerate stamina recovery, or strengthen attacks, each with a cost to another part of the loadout. The loadout is visible in the pause menu, and `Q` switches tools during play. Legacy saves preserve their permanent bonuses and begin with their owned relics unattuned.

The next additive sprint, **The Lamplighter's Margin**, implements the lantern:
raise it with `R` or the HUD button to reveal four concealed brass-plate accounts,
then copy them to the field journal with `E`. Road notices describe their locations
through geography. The lamp also widens personal light in dark interiors. It adds
no required shard, reward farming, fuel economy, or save-version change. Equipment
and relic illustrations come from the local `shed-dev-sprites` source, with
reproducible recipes and provenance alongside the committed assets.

**Implemented in 1.3:** regional elite sentinels and fortress wardens use distinct charge, ember-ring, fan, and crossfire tactics with shared telegraph geometry and field-guide counters. Ordinary enemies retain their established attacks. The four new sites are optional additions to the completed main pilgrimage; they do not add another shard requirement.

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

Keep the static browser build and offline Linux desktop package, with the old single-file constraint deliberately dropped so real sprite and tile atlases can ship as image assets (see the procedural sprite pipeline design spec). Every saveable gameplay change needs a deterministic state test, and every new landmark needs a visible in-world silhouette, a journal record, and directions expressed through geography rather than coordinates or markers. Performance work focuses on stable frame times during boss patterns and clean recovery from tab suspension or a failed region load. Desktop releases also verify installed assets, sandbox permissions, and saves across native close/reopen.

Content rating is a hard M. The full story now reads as institutional atrocity told in flat clerical language — the machine at the world's heart is built out of living minds, the nine shards are nine people still conscious inside it, and the game states this plainly rather than softening it. A content warning gates first launch (and only first launch; it is not shown again once acknowledged) and discloses institutional violence and death. Child killing and child harvesting are excluded from the story; all harvested people, including Roryn, are adults. Future narrative work must preserve this boundary.
