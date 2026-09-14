# Eldrinth development roadmap

Eldrinth will be a compact action RPG built around self-directed discovery. The player learns routes, threats, and motives from landmarks, witnesses, and a personal field journal. The journal preserves knowledge; it does not turn discoveries into map pins or a checklist.

## Milestone 1 — A journey worth following (implemented)

The first complete playable arc now has four connected regions: the Old Lands, Cinderwild, Moonlit Coast, and Starfall Moors. Nine shards are placed across those lands, and road signs provide directional, landmark-based information for finding them. Taking a shard is no longer a reward: each one now costs the pilgrim permanent maximum health on a rising curve, free for the first two and steeper from the sixth on, so the run's felt cost lands with the same weight as the story's. Character growth instead comes from the investigations and the relics they yield, not from the shards themselves.

Three investigations run alongside the main pilgrimage, and each one is an account of institutional violence read straight off the paperwork:

- **The Courier Who Never Came:** a courier's orders in Ilyarael, read against a still-conscious child sealed inside the vessel she refused to deliver at the Cinderwild shrine.
- **Names the Tide Kept:** an evacuation ledger at the salt graves that quietly reclassifies the people left behind as intake, read against the keeper's own signed confession at the coastal beacon.
- **A Borrowed Dawn:** a Starfall observatory's working notes on a self-administered intake prototype, read against its inventor, still conscious inside the guardian shell he built.

Discoveries can be made in any order. Once enough evidence is brought back to Orithel, the player chooses the outcome and receives one permanent, saveable reward — every choice folds a still-conscious person into the player's own equipment or extinguishes them outright; there is no option that costs nothing. The journal also accepts player-written observations. Region inhabitants, collected shards, quest decisions, wayfire checkpoints, relics, and notes survive saving, refreshes, deaths, and return trips.

## Milestone 2 — Make each expedition play differently

Add small, authored activity sites to each region: a hazardous crossing, a combat arena, a hidden refuge, and one optional encounter with a unique rule. Each site should offer a clue, material, or relationship rather than generic loot.

All nine shards now sit inside their own enterable fortresses rather than in open-field clearings. Each fortress has a distinct 26×19 authored layout, its own gate and return route, no wayfire to rest at, darkness, ember hazards, a warden, and a journal record of what was guarding the vessel. Dying inside resets that fortress's enemies and shard rather than the run itself.

Build a light equipment layer around meaningful tradeoffs: two active tools and three relic slots, with effects that change play patterns such as projectile-deflecting dashes, a slower heavy strike, or a lantern that reveals concealed messages. Expand enemy telegraphs and give each region one elite behavior that changes how the player uses space.

## Milestone 3 — Turn knowledge into mastery

Add New Pilgrimage mode with a seed shown in the journal, optional challenge vows, completion records, and alternate route conditions. The main story should remain finishable without every optional discovery; a fully investigated run should unlock a more informed final encounter and an epilogue that reflects the player's decisions.

## Production bar

Keep the browser-only build, with the old single-file constraint deliberately dropped so real sprite and tile atlases can ship as image assets (see the procedural sprite pipeline design spec). Every saveable gameplay change needs a deterministic state test, and every new landmark needs a visible in-world silhouette, a journal record, and directions expressed through geography rather than coordinates or markers. Performance work focuses on stable frame times during boss patterns and clean recovery from tab suspension or a failed region load.

Content rating is a hard M. The full story now reads as institutional atrocity told in flat clerical language — the machine at the world's heart is built out of living minds, the nine shards are nine people still conscious inside it, and the game states this plainly rather than softening it. A content warning gates first launch (and only first launch; it is not shown again once acknowledged) and discloses institutional violence, the killing of children, and one reference to sexual violence recorded as an administrative permission. Nothing in the approved copy is decorative shock — it is load-bearing to the premise — and it should not be walked back in future work without a deliberate decision to do so.
