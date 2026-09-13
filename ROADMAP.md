# Eldrinth development roadmap

Eldrinth will be a compact action RPG built around self-directed discovery. The player learns routes, threats, and motives from landmarks, witnesses, and a personal field journal. The journal preserves knowledge; it does not turn discoveries into map pins or a checklist.

## Milestone 1 — A journey worth following (implemented)

The first complete playable arc now has four connected regions: the Old Lands, Cinderwild, Moonlit Coast, and Starfall Moors. Nine shards are placed across those lands, and road signs provide directional, landmark-based information for finding them.

Three investigations run alongside the main pilgrimage:

- **The Courier Who Never Came:** compare the orders in Ilyarael with a memory at the Cinderwild shrine.
- **Names the Tide Kept:** compare the salt-graves ledger with the coastal beacon confession.
- **A Borrowed Dawn:** read the Starfall observatory record and defeat the astronomer's guardian.

Discoveries can be made in any order. Once enough evidence is brought back to Orithel, the player chooses the outcome and receives one permanent, saveable reward. The journal also accepts player-written observations. Region inhabitants, collected shards, quest decisions, wayfire checkpoints, relics, and notes survive saving, refreshes, deaths, and return trips.

## Milestone 2 — Make each expedition play differently

Add small, authored activity sites to each region: a hazardous crossing, a combat arena, a hidden refuge, and one optional encounter with a unique rule. Each site should offer a clue, material, or relationship rather than generic loot.

Build a light equipment layer around meaningful tradeoffs: two active tools and three relic slots, with effects that change play patterns such as projectile-deflecting dashes, a slower heavy strike, or a lantern that reveals concealed messages. Expand enemy telegraphs and give each region one elite behavior that changes how the player uses space.

## Milestone 3 — Turn knowledge into mastery

Add New Pilgrimage mode with a seed shown in the journal, optional challenge vows, completion records, and alternate route conditions. The main story should remain finishable without every optional discovery; a fully investigated run should unlock a more informed final encounter and an epilogue that reflects the player's decisions.

## Production bar

Keep the browser-only build, with the old single-file constraint deliberately dropped so real sprite and tile atlases can ship as image assets (see the procedural sprite pipeline design spec). Every saveable gameplay change needs a deterministic state test, and every new landmark needs a visible in-world silhouette, a journal record, and directions expressed through geography rather than coordinates or markers. Performance work focuses on stable frame times during boss patterns and clean recovery from tab suspension or a failed region load.
