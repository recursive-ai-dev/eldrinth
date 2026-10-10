# The Wayfarer’s Kit

41 implemented improvements to the existing pilgrimage. Equipment, lanterns,
voices, the existing journal search, and pre-existing display options remain
part of the base game and are not counted as new work here.

## Navigation

1. **Local atlas:** open a paused chart with M or the on-screen Atlas button.
2. **Saved surveys:** landmarks discovered through sight or records survive save/reload; older saves remain compatible.
3. **Landmark identities:** distinct generated markers and descriptions for wayfires, sanctuaries, roads, doorways, and records.
4. **Atlas search:** find a known place by name or description.
5. **Landmark filters:** narrow the chart and list by place type.
6. **Atlas ordering:** sort known places by distance or name.
7. **Chart extent control:** switch between the surveyed area and full region dimensions without revealing hidden objects.
8. **Pinned destinations:** carry a live compass bearing, straight-line distance, and arrival hint into play; clear the pin from the atlas.
9. **Position readout:** see facing direction and tile coordinates in the field and atlas.
10. **Sanctuary status:** recognize when the wayfarer stands inside a settlement’s safe area.
11. **Return-point reference:** find the active checkpoint and whether it belongs to this region.
12. **Accessible combat resources:** health/stamina/boss meter semantics and explicit low-health/exhaustion labels supplement color.

## Journal and guide

13. **Illustrated field guide:** a separate reference view inside the field journal.
14. **First-steps checklist:** six milestones backed by actual journal evidence.
15. **Combat dossiers:** portraits and practical tactics for ordinary enemy types, plus Last Breath guidance.
16. **Equipment reference:** weapon and relic descriptions drawn from the same definitions as the game.
17. **Expedition index:** discovery/completion tracking and optional route hints for the four existing sites.
18. **Lamplight index:** inscription collection progress with optional geographic hints.
19. **Guide search:** search across guide subjects and sections.
20. **Record status filters:** open threads, decisions/completions, and personal observations.
21. **Record ordering:** original/reverse order, title, or source.
22. **Filter recovery:** clear active filters from the toolbar or empty-result view.
23. **Journal progress summary:** counts of records, investigations, decisions, expeditions, and inscriptions.
24. **Clipboard copies:** copy the currently filtered records, with explicit clipboard-failure feedback.
25. **Text exports:** download the selected journal view as a readable text file.
26. **Note-writing feedback:** character count, whitespace validation, and confirmation of a recorded observation.

## Loadout, comfort, and saves

27. **Loadout statistics:** current damage, strike interval, walking speed, dash cost, and stamina recovery.
28. **Relic comparisons:** preview attunement or removal without mutating equipment or permanent rewards.
29. **Acquired-relic filter:** focus the equipment list on owned relics.
30. **Automatic pause:** losing window/tab focus pauses active play; the option can be disabled.
31. **High contrast:** brighter reading text, stronger controls, and solid reading panels.
32. **Atmosphere control:** disable the weather overlay independently of other display settings.
33. **Camera-shake control:** disable impact shake without changing combat damage or rules.
34. **Travel-settings reset:** restore the comfort defaults; settings persist and report storage failure.
35. **Fullscreen control:** enter/leave browser fullscreen on supported devices, with failure feedback.
36. **Manual checkpoint:** save without leaving the pause menu, keeping play frozen until persistence completes.
37. **Save feedback:** successful save acknowledgement and the last successful save time during the visit.
38. **Slot timestamps:** title-screen records show when each pilgrimage was last written.
39. **Journey statistics:** active travel time, returns after falling, parries, carried names, and unheard memories in one pause section.
40. **Taking forecast:** preview the next vessel’s permanent health cost and resulting maximum health using the game’s harvest rules.
41. **Reproducible field-kit artwork:** 24 offline PNGs from Shed Dev Sprites, a shared accessible icon component, recipes, integrity checks, source attribution, and a visual contact sheet.

## Verification

Final validation: **428 unit/integration tests, 30 production-browser tests, and
7 desktop unit checks passed**. Production build, nested-path release verification,
field-kit regeneration verification, and `git diff --check` passed. The browser
suite used the installed Chrome channel and blocked optional external fonts.

The new logic has unit coverage for landmark visibility, filters, bearings,
checkpoint migration, loadout previews, guide progress, export text, settings,
focus-loss pausing, and disabled camera shake. Browser coverage exercises atlas
pinning/search, keyboard isolation, save/reload, comfort preferences, guide
navigation, export, and compact portrait/landscape layouts. The original gameplay,
lantern, voice, equipment, persistence, and release checks remain in the suite.

```bash
npm test
npm run build
npm run verify:release
npm run verify:field-kit
npm run test:browser
# Local alternative if Chrome is already installed:
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

Pins last for the current play session. Surveyed places persist in the selected
save slot. The atlas provides direct bearings, not pathfinding. The field guide
adds references to existing content rather than new quests or enemy types.
