# NPC portrait briefs

Conversation UI reserves a frame for every named NPC. The `portrait.id` below is the stable handoff key; use it as the exported filename (for example, `scribe-althea.png`). Portraits should be chest-up, three-quarter view, with the character looking inward toward the dialogue text. Keep the background simple and dark so the face carries at small size.

| Portrait ID | Character | Locked visual direction | Regional light |
| --- | --- | --- | --- |
| `orithel-the-last-watcher` | Orithel | Pale teal projection; severe gold-and-ivory collar; drifting white hair; fractured Spire halo. | Cold teal from below |
| `scribe-althea` | Scribe Althea | Ochre hood; silver hair pinned by a quill; ink-stained fingers; cracked ledger. | Candle amber |
| `sister-mirene` | Hollow Sister Mirene | Sea-green veil; linen-wrapped hands with a faint inner glow; black-glass prayer beads. | Soft jade |
| `barris-the-smith` | Barris the Smith | Broad frame; cropped iron-grey beard; soot-stiff apron; broken sword and smith's hammer. | Forge amber |
| `kiln-master-vance` | Kiln-Master Vance | Copper half-mask; ember goggles; charcoal cloak dusted with ash; tally hook. | Orange kiln glow |
| `cinder-nurse-greta` | Cinder-Nurse Greta | Cropped dark curls; singed linen cap; rust-red coat; sulfur gloves and blue flask. | Warm orange with blue accent |
| `elodie-outrunner` | Elodie the Outrunner | Wiry; one shaved temple; ash-grey scarf; patched red climbing coat; hooked ravine staff. | Ash haze and embers |
| `mistress-morveth` | Mistress Morveth | Storm-water oilskin; braided white hair; brass dive goggles; name-tags sewn into sleeves. | Blue-grey sea light |
| `sister-lyra` | Sister Lyra of the Brine | Shaved head; pearl ear cuffs; kelp-green layers; netted satchel of glowing salve jars. | Mint sea light |
| `kieran-blind-oar` | Kieran the Blind Oar | Weathered face; clouded eyes; salt-bleached blue coat; carved oar staff; rope coil. | Pale moonlight |
| `reeve-toran` | Reeve Toran | Gaunt; violet mantle; cracked brass monocle; black wind-tossed hair; telescope lens. | Lavender starlight |
| `hermit-cassian` | Hermit Cassian | Close silver beard; plum hooded coat; moss in sleeves; meteorite bowl of spring water. | Muted violet |
| `mina-drift-child` | Mina the Drift-Child | Oversized charcoal cloak with meteor-glass beads; pale braids; ink-dark eyes; tuning fork. | Lavender with silver sparks |

The empty frame deliberately shows the portrait ID in-game, so no dialogue needs to be rewritten when art is supplied. The code does not currently load portrait files; it reserves the presentation and data contract first.
