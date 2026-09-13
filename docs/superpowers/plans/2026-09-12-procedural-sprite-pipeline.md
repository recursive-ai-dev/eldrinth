# Procedural Sprite Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Eldrinth's 100%-procedural Canvas2D vector rendering with real
pixel-art sprites (tiles, player, enemies, items) generated offline by a
vendored, dark-fantasy-tuned copy of the shed-dev-sprites generator, loaded
and drawn via a new sprite-atlas module in the TypeScript renderer.

**Architecture:** A Python tool vendored at `tools/spritegen/` (adapted from
`~/Projects/shed-dev-sprites/generator`) is driven by a catalog file mapping
every game entity to generator params. A driver script batch-generates PNG
sprite sheets + JSON manifests into `src/assets/sprites/`, committed as
normal source assets. A new `spriteAtlas.ts` loads them at runtime; existing
procedural `draw*` functions in `renderer.ts` are replaced with `drawImage`
calls. Python is a dev-time-only dependency — never shipped, never invoked
in the browser.

**Tech Stack:** Python 3 + Pillow + numpy (vendored generator, dev-only),
TypeScript/Vite/Canvas2D (game), Vitest (tests).

**Spec:** `docs/superpowers/specs/2026-09-12-procedural-sprite-pipeline-design.md`

## Global Constraints

- Python is a dev-time tool only. It must never be imported, bundled, or
  invoked from browser code, and `npm run build`/`npm run dev` must not
  require Python to be installed to run the game (only to regenerate art).
- Every value of `T` in `src/game/constants.ts` (20 tile types: `GRASS,
  DGRASS, PATH, WATER, TREE, ROCK, RFLOOR, RWALL, CRYSTAL, FLOWER, BRIDGE,
  GRAVE, BONES, TALLGRASS, SPIREFLOOR, SAND, LEDGE, SLOPE_UP_LEFT,
  SLOPE_UP_RIGHT, TRIGGER`), every `EnemyType` (`wraith, sentinel, adept,
  boss`), every `ItemType` (`shard, potion`), and `player` must have exactly
  one catalog entry and a generated, committed asset — no exceptions.
- Generation must be fully deterministic: the same catalog entry always
  produces the same pixels (this is the generator's own guarantee via
  `pixel_hash`; do not break it).
- The `vite-plugin-singlefile` constraint is dropped for this work (per the
  approved spec) — `dist/` becomes a normal multi-file build.
- Sprite native resolution is 32×32 (human/creature) or 16×16 (tile) per the
  vendored generator's `DEFAULT_SIZE`/`TileSpriteGenerator.default_size`;
  the renderer scales up at draw time with `imageSmoothingEnabled = false`.

---

### Task 1: Vendor the generator package

**Files:**
- Create: `tools/spritegen/` (copy of `~/Projects/shed-dev-sprites/generator/` and its sibling modules it imports — `rng.py`, `color.py` — from the shed-dev-sprites repo root)
- Create: `tools/spritegen/README.md`
- Test: `tools/spritegen/smoke_test.py`

**Interfaces:**
- Produces: `tools.spritegen.generator.registry.get_generator(name: str, **kwargs)`, returning a `SpriteGenerator` whose `.generate(seed=0, **options) -> Sprite` is used by every later task.

- [ ] **Step 1: Copy the generator package**

```bash
mkdir -p /home/damien/Projects/eldrinth/tools/spritegen
cp -r /home/damien/Projects/shed-dev-sprites/generator /home/damien/Projects/eldrinth/tools/spritegen/generator
cp /home/damien/Projects/shed-dev-sprites/requirements.txt /home/damien/Projects/eldrinth/tools/spritegen/requirements.txt
```

Do not copy `ai_human_generator.py`, `mass_generator.py`, `pure_generator.py`,
`web.py`, `web_frontend.html`, or `cli.py`'s standalone entry point wiring —
none of these are used by eldrinth's pipeline (see Global Constraints: no
web UI, no CLI surface, catalog-driven only). If any of these files are
imported transitively by a module you DO need (check with `grep -rn "import"
tools/spritegen/generator`), keep only the imported module, not the whole
file's unused surface.

- [ ] **Step 2: Write a README noting this is vendored**

Create `tools/spritegen/README.md`:

```markdown
# spritegen (vendored)

Adapted from `shed-dev-sprites` (https://github.com/... local project at
~/Projects/shed-dev-sprites) — a fully offline, deterministic, math-only
pixel-art sprite generator (no network calls, no ML models).

This copy is dev-tooling only: it generates the PNG/JSON assets committed
under `src/assets/sprites/` and is never imported by the shipped game.
Requires Python 3.10+, Pillow, numpy (`pip install -r requirements.txt`).

Regenerate all game art: `npm run gen:sprites`
```

- [ ] **Step 3: Write and run a smoke test**

Create `tools/spritegen/smoke_test.py`:

```python
"""Smoke test: vendored generator produces a deterministic sprite."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.registry import get_generator  # noqa: E402


def main():
    gen = get_generator("human")
    a = gen.generate(seed=42)
    b = gen.generate(seed=42)
    assert a.pixel_hash == b.pixel_hash, "same seed must produce identical pixels"
    assert a.size == (32, 32)
    print("OK:", a.pixel_hash)


if __name__ == "__main__":
    main()
```

Run: `cd /home/damien/Projects/eldrinth && python3 tools/spritegen/smoke_test.py`
Expected: prints `OK: <32-char-hex-hash>` with no traceback.

- [ ] **Step 4: Commit**

```bash
cd /home/damien/Projects/eldrinth
git add tools/spritegen
git commit -m "Vendor shed-dev-sprites generator as dev-time spritegen tool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Add dark-fantasy palettes

**Files:**
- Modify: `tools/spritegen/generator/math/palette.py`
- Test: `tools/spritegen/palette_test.py`

**Interfaces:**
- Consumes: the existing `PALETTES: Dict[str, Tuple[Vec3, Vec3, Vec3, Vec3]]` module-level dict and `named_palette(name: str, t: float) -> RGB` in this file.
- Produces: eight new palette names usable anywhere via `named_palette(<name>, t)`: `grim_steel`, `wraith_ash`, `rusted_stone`, `cult_blood`, `corrupted_flesh`, `bone_relic`, `sickly_green`, `black_water`.

- [ ] **Step 1: Add the new palette entries**

In `tools/spritegen/generator/math/palette.py`, find the `PALETTES = { ... }`
dict and add these entries (values are cosine-palette `(bias, amplitude,
frequency, phase)` triples per RGB channel, following the exact pattern of
the existing entries):

```python
    "grim_steel": (
        (0.38, 0.40, 0.43),
        (0.18, 0.18, 0.20),
        (1.00, 1.00, 1.00),
        (0.00, 0.05, 0.12),
    ),
    "wraith_ash": (
        (0.30, 0.34, 0.32),
        (0.16, 0.18, 0.17),
        (0.80, 0.85, 0.80),
        (0.10, 0.15, 0.20),
    ),
    "rusted_stone": (
        (0.40, 0.30, 0.22),
        (0.20, 0.14, 0.10),
        (0.90, 0.80, 0.70),
        (0.00, 0.08, 0.18),
    ),
    "cult_blood": (
        (0.32, 0.08, 0.10),
        (0.22, 0.06, 0.08),
        (1.00, 0.60, 0.60),
        (0.00, 0.35, 0.40),
    ),
    "corrupted_flesh": (
        (0.34, 0.26, 0.30),
        (0.20, 0.14, 0.18),
        (0.85, 0.70, 0.90),
        (0.05, 0.30, 0.55),
    ),
    "bone_relic": (
        (0.62, 0.58, 0.48),
        (0.20, 0.18, 0.16),
        (0.70, 0.70, 0.60),
        (0.02, 0.06, 0.10),
    ),
    "sickly_green": (
        (0.28, 0.34, 0.18),
        (0.16, 0.20, 0.10),
        (0.80, 0.90, 0.70),
        (0.10, 0.05, 0.25),
    ),
    "black_water": (
        (0.06, 0.10, 0.16),
        (0.04, 0.06, 0.10),
        (0.60, 0.70, 0.90),
        (0.30, 0.35, 0.45),
    ),
```

- [ ] **Step 2: Write and run the palette test**

Create `tools/spritegen/palette_test.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.math.palette import named_palette  # noqa: E402

NEW_PALETTES = [
    "grim_steel", "wraith_ash", "rusted_stone", "cult_blood",
    "corrupted_flesh", "bone_relic", "sickly_green", "black_water",
]


def main():
    for name in NEW_PALETTES:
        rgb = named_palette(name, 0.5)
        assert len(rgb) == 3, f"{name} did not return an RGB triple"
        for channel in rgb:
            assert 0 <= channel <= 255, f"{name} produced an out-of-range channel: {rgb}"
    print("OK:", len(NEW_PALETTES), "palettes valid")


if __name__ == "__main__":
    main()
```

Run: `python3 tools/spritegen/palette_test.py`
Expected: `OK: 8 palettes valid`

- [ ] **Step 3: Commit**

```bash
git add tools/spritegen/generator/math/palette.py tools/spritegen/palette_test.py
git commit -m "Add dark-fantasy palettes to vendored spritegen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Make creature archetype overridable

**Files:**
- Modify: `tools/spritegen/generator/sprites/creature.py:95-101`
- Test: `tools/spritegen/creature_archetype_test.py`

**Interfaces:**
- Consumes: `_ARCHETYPES` list and `rng.choice` call in `CreatureSpriteGenerator._build`.
- Produces: `CreatureSpriteGenerator().generate(seed, archetype="golem")` now forces that archetype instead of picking randomly from the seed; omitting `archetype` keeps today's random-from-seed behavior unchanged.

- [ ] **Step 1: Patch `_build` to accept an explicit archetype**

In `tools/spritegen/generator/sprites/creature.py`, change:

```python
        rng = self.rng(seed)

        archetype = rng.choice(_ARCHETYPES)
```

to:

```python
        rng = self.rng(seed)

        requested = options.get("archetype")
        if requested is not None and requested in _ARCHETYPES:
            archetype = requested
        else:
            archetype = rng.choice(_ARCHETYPES)
```

Note `options` (the raw kwargs passed to `generate`) is already in scope in
`_build(self, seed, **options)` — `opt = options_from(options)` on the
preceding line normalizes a *different*, fixed set of keys and does not
pass `archetype` through, so read `archetype` from the original `options`
dict, not from `opt`.

- [ ] **Step 2: Write and run the override test**

Create `tools/spritegen/creature_archetype_test.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.sprites.creature import CreatureSpriteGenerator  # noqa: E402


def main():
    gen = CreatureSpriteGenerator()
    forced = gen.generate(seed=1, archetype="golem")
    assert forced.spec["archetype"] == "golem", forced.spec["archetype"]

    forced_again = gen.generate(seed=1, archetype="golem")
    assert forced.pixel_hash == forced_again.pixel_hash, "override must stay deterministic"

    unforced = gen.generate(seed=1)
    print("OK: forced=golem, unforced=", unforced.spec["archetype"])


if __name__ == "__main__":
    main()
```

Run: `python3 tools/spritegen/creature_archetype_test.py`
Expected: `OK: forced=golem, unforced= <some archetype>` with no assertion error.

- [ ] **Step 3: Commit**

```bash
git add tools/spritegen/generator/sprites/creature.py tools/spritegen/creature_archetype_test.py
git commit -m "Allow forcing creature archetype via generate(archetype=...)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Add attack-pose kinematics for humans

**Files:**
- Modify: `tools/spritegen/generator/math/pose.py` (add `attack_pose`)
- Modify: `tools/spritegen/generator/pipeline.py` (thread `action` option)
- Modify: `tools/spritegen/generator/sprites/human.py:82-195,350-358` (use `action`)
- Modify: `tools/spritegen/generator/sprites/base.py:143-158` (accept `action` in `generate_walk`/`generate_anim_sheet`)
- Test: `tools/spritegen/human_attack_test.py`

**Interfaces:**
- Consumes: `Rig`, `Joint`, `DIRECTIONS` from `math/pose.py`; `options_from` from `pipeline.py`.
- Produces: `HumanSpriteGenerator().generate(seed, action="attack", frame=N, frames=M)` and `HumanSpriteGenerator().generate_anim_sheet(seed, action="attack")` render a forward weapon-thrust pose instead of the walk cycle.

- [ ] **Step 1: Add `attack_pose` to `math/pose.py`**

Add this function after `walk_pose` in `tools/spritegen/generator/math/pose.py`:

```python
def attack_pose(rig: Rig, frame: int, nframes: int = 4, facing: str = "front") -> Rig:
    """A single forward weapon-thrust cycle: wind-up -> lunge -> recover.

    Unlike walk_pose's cyclic stride, this is a one-shot arc across
    ``nframes``: frame 0 is the wind-up (arm drawn back), the middle frame(s)
    are full extension (arm/leg driven forward), and the last frame recovers
    toward neutral. Only the primary (right) arm/leg swing; the off-hand and
    torso get a much smaller counter-motion so the pose still reads as one
    body committing to a strike, not both sides mirroring the swing.
    """
    out = rig.copy()
    n = max(1, nframes - 1)
    u = frame / float(n)  # 0 at wind-up, 1 at recover
    # wind-up (u=0) -> extend (u=0.5) -> recover (u=1): a single hump peaking mid-swing
    extend = math.sin(u * math.pi)  # 0 at both ends, 1 at u=0.5
    windup = max(0.0, 1.0 - u * 2.0)  # 1 at u=0, 0 by u=0.5

    lunge_forward = 1.6 * extend
    lunge_back = 1.1 * windup
    lift = 0.4 * extend

    side = facing in ("left", "right")

    def _limb(name: str, forward: float, up: float, zsign: float = 1.0):
        if name not in out.joints:
            return
        j = out.joints[name]
        if side:
            j.z += forward * zsign
            j.y -= up
        else:
            j.x += forward * 0.6
            j.y -= up * 0.4

    # primary (right) arm drives the strike: pulled back during wind-up,
    # thrust forward through extension.
    _limb("hand_r", lunge_forward - lunge_back, lift, 1.0)
    _limb("elbow_r", (lunge_forward - lunge_back) * 0.6, lift * 0.5, 1.0)
    _limb("shoulder_r", (lunge_forward - lunge_back) * 0.15, 0.0, 0.6)

    # off-hand/torso counter-motion, kept small
    _limb("hand_l", -lunge_forward * 0.25, 0.0, -1.0)
    _limb("shoulder_l", -lunge_forward * 0.1, 0.0, -0.5)

    # weight shifts onto the front (right) leg through the strike
    _limb("hip_r", lunge_forward * 0.25, 0.0, 1.0)
    _limb("knee_r", lunge_forward * 0.35, 0.0, 1.0)
    _limb("foot_r", lunge_forward * 0.4, 0.0, 1.0)

    return out
```

- [ ] **Step 2: Thread `action` through `pipeline.options_from`**

In `tools/spritegen/generator/pipeline.py`, find `options_from` and add
`"action"` to the normalized dict it returns (default `"walk"`):

```python
    normalized["action"] = options.get("action", "walk")
```

Add this alongside the existing `normalized["direction"] = ...` /
`normalized["frame"] = ...` lines in that function (match the existing
style — `options_from` already builds a dict of normalized keys from the
raw `options` mapping; insert this line where the other keys are set,
before the `return normalized` at the end of the function).

- [ ] **Step 3: Use `action` in `human.py`'s `_render`**

In `tools/spritegen/generator/sprites/human.py`, change the import at the
top:

```python
from ..math.pose import Rig, walk_pose, project_point, DIRECTIONS
```

to:

```python
from ..math.pose import Rig, walk_pose, attack_pose, project_point, DIRECTIONS
```

Change the `_render` signature and body (around line 350-358) to accept and
use `action`:

```python
    def _render(
        self, seed, layout, skin, hair, eye, top, bottom,
        top_style, bottom_style, hair_style, facial_hair,
        has_glasses, has_jewelry, has_hat, gender, direction, frame, nframes,
        action="walk",
    ) -> Canvas:
        w, h = self.size
        canvas = Canvas(w, h)
        cx = layout["center"]
        base_rig = self._make_rig(layout)
        if action == "attack":
            rig = attack_pose(base_rig, frame, nframes, facing=direction)
        else:
            rig = walk_pose(base_rig, frame, nframes, facing=direction)
```

Then in `_build` (around line 82-181), read `action` from `opt` and pass it
to `_render`:

```python
        opt = options_from(options)
        direction = opt["direction"] if opt["direction"] in DIRECTIONS else "front"
        frame = opt["frame"] % max(1, opt["frames"])
        action = opt["action"]
```

and in the `self._render(...)` call, append `action` as the final positional
argument to match the new signature:

```python
        canvas = self._render(
            seed, layout, skin, hair, eye, top, bottom,
            top_style, bottom_style, hair_style, facial_hair,
            has_glasses, has_jewelry, has_hat, gender, direction, frame,
            opt["frames"], action,
        )
```

Also add `"action": action,` to the `spec` dict already built in `_build`
(next to the existing `"direction": direction, "frame": frame,` entries),
so the manifest records which action a sheet belongs to.

- [ ] **Step 4: Accept `action` in `SpriteGenerator.generate_walk`/`generate_anim_sheet`**

In `tools/spritegen/generator/sprites/base.py`, these two methods already
forward arbitrary `**options` to `self.generate(...)`, so `action="attack"`
passed in already reaches `_build`. No code change is required here beyond
confirming this — but add a short comment so a future reader doesn't assume
`action` needs separate plumbing:

```python
    def generate_walk(self, seed=0, direction: str = "front", frames: int = WALK_FRAMES, **options) -> List[Sprite]:
        """Walk-cycle frames for one direction. Pass action="attack" via
        **options to render an attack cycle instead of the default walk."""
        return [self.generate(seed, direction=direction, frame=i, frames=frames, **options)
                for i in range(frames)]
```

- [ ] **Step 5: Write and run the attack-pose test**

Create `tools/spritegen/human_attack_test.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.sprites.human import HumanSpriteGenerator  # noqa: E402


def main():
    gen = HumanSpriteGenerator()
    walk = gen.generate(seed=7, direction="front", frame=1, frames=4, action="walk")
    attack = gen.generate(seed=7, direction="front", frame=1, frames=4, action="attack")
    assert walk.pixel_hash != attack.pixel_hash, "attack pose must render differently from walk"
    assert attack.spec["action"] == "attack"

    img, meta = gen.generate_anim_sheet(seed=7, frames=4, action="attack")
    assert meta["frames"] == 4
    assert img.size[0] > 0 and img.size[1] > 0
    print("OK: attack sheet", img.size)


if __name__ == "__main__":
    main()
```

Run: `python3 tools/spritegen/human_attack_test.py`
Expected: `OK: attack sheet (<w>, <h>)` with no assertion error.

- [ ] **Step 6: Commit**

```bash
git add tools/spritegen/generator/math/pose.py tools/spritegen/generator/pipeline.py \
        tools/spritegen/generator/sprites/human.py tools/spritegen/generator/sprites/base.py \
        tools/spritegen/human_attack_test.py
git commit -m "Add attack-pose kinematics for human sprites

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Add attack-pose variant for creatures

**Files:**
- Modify: `tools/spritegen/generator/sprites/creature.py`
- Test: `tools/spritegen/creature_attack_test.py`

**Interfaces:**
- Consumes: the `_build`/`_render` methods patched in Task 3, and `options_from` from `pipeline.py` (already imported in this file).
- Produces: `CreatureSpriteGenerator().generate(seed, action="attack", frame=N)` renders a forward-lunging, mouth-wide variant; `action` defaults to `"walk"` and is recorded in `spec["action"]`.

- [ ] **Step 1: Read `action` in `_build` and pass it to `_render`**

In `tools/spritegen/generator/sprites/creature.py`, in `_build` (patched in
Task 3), add after the `opt = options_from(options)` line:

```python
        action = opt["action"]
```

Update the `self._render(...)` call to append `action`:

```python
        canvas = self._render(
            seed, rng, archetype, geom, base, belly, outline, accent,
            horned, spots, direction, frame, action,
        )
```

Add `"action": action,` to the `spec` dict next to the existing
`"direction": direction, "frame": frame,` entries.

- [ ] **Step 2: Use `action` in `_render` for a lunge + wide-mouth attack look**

Change the `_render` signature:

```python
    def _render(self, seed, rng, archetype, geom, base, belly, outline, accent,
                horned, spots, direction, frame, action="walk") -> Canvas:
```

Inside `_render`, the leg-lift block already reads `frame` to alternate a
walk lift:

```python
                lift = 0
                if frame:
                    phase = (frame + i) % 2
                    lift = -1 if phase == 0 else 1
```

Change it so an attack action drives every leg forward together (a lunge)
instead of alternating:

```python
                lift = 0
                if action == "attack" and frame:
                    lift = -1  # all legs plant forward/down together — a lunge, not a stride
                elif frame:
                    phase = (frame + i) % 2
                    lift = -1 if phase == 0 else 1
```

Then find the mouth-drawing block:

```python
        # mouth
        if xs:
            mx = (min(xs) + max(xs)) // 2
            my = min(h - 3, max(ys) - 2)
            for dx in range(-2, 3):
                if canvas.opaque(mx + dx, my):
                    canvas.set(mx + dx, my, color.darken(base, 0.5), TAG_BODY)
            for dx in range(-1, 2):
                canvas.set(mx + dx, my - 1, (240, 240, 230), TAG_ACCENT)
```

Widen the mouth range when attacking (a snarl), by changing the two `range`
calls to depend on `action`:

```python
        # mouth (wider snarl mid-attack)
        if xs:
            mx = (min(xs) + max(xs)) // 2
            my = min(h - 3, max(ys) - 2)
            mouth_half = 3 if (action == "attack" and frame) else 2
            for dx in range(-mouth_half, mouth_half + 1):
                if canvas.opaque(mx + dx, my):
                    canvas.set(mx + dx, my, color.darken(base, 0.5), TAG_BODY)
            for dx in range(-(mouth_half - 1), mouth_half):
                canvas.set(mx + dx, my - 1, (240, 240, 230), TAG_ACCENT)
```

- [ ] **Step 3: Write and run the creature attack test**

Create `tools/spritegen/creature_attack_test.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.sprites.creature import CreatureSpriteGenerator  # noqa: E402


def main():
    gen = CreatureSpriteGenerator()
    walk = gen.generate(seed=3, archetype="golem", direction="front", frame=1, frames=4, action="walk")
    attack = gen.generate(seed=3, archetype="golem", direction="front", frame=1, frames=4, action="attack")
    assert walk.pixel_hash != attack.pixel_hash, "attack action must render differently from walk"
    assert attack.spec["action"] == "attack"
    print("OK: creature attack differs from walk")


if __name__ == "__main__":
    main()
```

Run: `python3 tools/spritegen/creature_attack_test.py`
Expected: `OK: creature attack differs from walk`

- [ ] **Step 4: Commit**

```bash
git add tools/spritegen/generator/sprites/creature.py tools/spritegen/creature_attack_test.py
git commit -m "Add lunge/snarl attack variant for creature sprites

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Write the entity catalog

**Files:**
- Create: `tools/spritegen/catalog.py`
- Test: `tools/spritegen/catalog_test.py`

**Interfaces:**
- Consumes: `generator.registry.get_generator` (Task 1), the `archetype`/`action`/`palette` options added in Tasks 2-5.
- Produces: `CATALOG: Dict[str, dict]` — one entry per game entity, each with at minimum `{"kind": str, "seed": str}` and generator-specific keys (`archetype`, `palette`, `anims`, `autotile`, `mask` as applicable). This is the single source of truth every later task (driver script, completeness test) reads.

- [ ] **Step 1: Write the catalog**

Create `tools/spritegen/catalog.py`. This must have exactly one entry per
`T` tile value, `EnemyType`, `ItemType`, and `player` — see Global
Constraints for the full authoritative list.

```python
"""Single source of truth mapping every eldrinth game entity to spritegen
generator parameters. Every T tile value (src/game/constants.ts), every
EnemyType, every ItemType, and "player" must appear here exactly once."""

CATALOG = {
    # -- player & enemies (kind: human | creature) --------------------------
    "player": {
        "kind": "human", "seed": "eldrinth-player-01",
        "palette_hint": "grim_steel", "anims": ["walk", "attack"],
    },
    "enemy.wraith": {
        "kind": "creature", "archetype": "tentacle", "seed": "eldrinth-wraith-01",
        "palette_hint": "wraith_ash", "anims": ["walk", "attack"],
    },
    "enemy.sentinel": {
        "kind": "creature", "archetype": "golem", "seed": "eldrinth-sentinel-01",
        "palette_hint": "rusted_stone", "anims": ["walk", "attack"],
    },
    "enemy.adept": {
        "kind": "human", "seed": "eldrinth-adept-01",
        "palette_hint": "cult_blood", "anims": ["walk", "attack"],
    },
    "enemy.boss": {
        "kind": "creature", "archetype": "biped", "seed": "eldrinth-boss-01",
        "palette_hint": "corrupted_flesh", "anims": ["walk", "attack"],
    },

    # -- items (kind: item, static) ------------------------------------------
    "item.shard": {"kind": "item", "seed": "eldrinth-item-shard-01", "palette_hint": "bone_relic"},
    "item.potion": {"kind": "item", "seed": "eldrinth-item-potion-01", "palette_hint": "cult_blood"},

    # -- tiles (kind: tile, static, one per T enum value) --------------------
    "tile.grass":          {"kind": "tile", "seed": "eldrinth-tile-grass",          "tile_kind": "grass", "palette_hint": "sickly_green", "autotile": True},
    "tile.dgrass":         {"kind": "tile", "seed": "eldrinth-tile-dgrass",         "tile_kind": "grass", "palette_hint": "sickly_green"},
    "tile.path":           {"kind": "tile", "seed": "eldrinth-tile-path",          "tile_kind": "dirt",  "palette_hint": "rusted_stone"},
    "tile.water":          {"kind": "tile", "seed": "eldrinth-tile-water",         "tile_kind": "water", "palette_hint": "black_water",   "autotile": True},
    "tile.tree":           {"kind": "tile", "seed": "eldrinth-tile-tree",          "tile_kind": "moss",  "palette_hint": "sickly_green"},
    "tile.rock":           {"kind": "tile", "seed": "eldrinth-tile-rock",          "tile_kind": "stone", "palette_hint": "rusted_stone"},
    "tile.rfloor":         {"kind": "tile", "seed": "eldrinth-tile-rfloor",        "tile_kind": "cobble","palette_hint": "grim_steel"},
    "tile.rwall":          {"kind": "tile", "seed": "eldrinth-tile-rwall",         "tile_kind": "brick", "palette_hint": "grim_steel"},
    "tile.crystal":        {"kind": "tile", "seed": "eldrinth-tile-crystal",       "tile_kind": "stone", "palette_hint": "wraith_ash"},
    "tile.flower":         {"kind": "tile", "seed": "eldrinth-tile-flower",        "tile_kind": "grass", "palette_hint": "sickly_green"},
    "tile.bridge":         {"kind": "tile", "seed": "eldrinth-tile-bridge",        "tile_kind": "wood",  "palette_hint": "rusted_stone"},
    "tile.grave":          {"kind": "tile", "seed": "eldrinth-tile-grave",         "tile_kind": "stone", "palette_hint": "bone_relic"},
    "tile.bones":          {"kind": "tile", "seed": "eldrinth-tile-bones",         "tile_kind": "sand",  "palette_hint": "bone_relic"},
    "tile.tallgrass":      {"kind": "tile", "seed": "eldrinth-tile-tallgrass",     "tile_kind": "grass", "palette_hint": "sickly_green"},
    "tile.spirefloor":     {"kind": "tile", "seed": "eldrinth-tile-spirefloor",    "tile_kind": "cobble","palette_hint": "wraith_ash"},
    "tile.sand":           {"kind": "tile", "seed": "eldrinth-tile-sand",          "tile_kind": "sand",  "palette_hint": "rusted_stone"},
    "tile.ledge":          {"kind": "tile", "seed": "eldrinth-tile-ledge",         "tile_kind": "stone", "palette_hint": "rusted_stone"},
    "tile.slope_up_left":  {"kind": "tile", "seed": "eldrinth-tile-slope-up-left", "tile_kind": "dirt",  "palette_hint": "rusted_stone"},
    "tile.slope_up_right": {"kind": "tile", "seed": "eldrinth-tile-slope-up-right","tile_kind": "dirt",  "palette_hint": "rusted_stone"},
    "tile.trigger":        {"kind": "tile", "seed": "eldrinth-tile-trigger",       "tile_kind": "cobble","palette_hint": "cult_blood"},
}

# Maps each catalog key back to the exact eldrinth-side identifier the
# renderer/loader will look it up by (see spriteAtlas.ts in Task 9).
TILE_KEY_BY_T_NAME = {
    "GRASS": "tile.grass", "DGRASS": "tile.dgrass", "PATH": "tile.path",
    "WATER": "tile.water", "TREE": "tile.tree", "ROCK": "tile.rock",
    "RFLOOR": "tile.rfloor", "RWALL": "tile.rwall", "CRYSTAL": "tile.crystal",
    "FLOWER": "tile.flower", "BRIDGE": "tile.bridge", "GRAVE": "tile.grave",
    "BONES": "tile.bones", "TALLGRASS": "tile.tallgrass",
    "SPIREFLOOR": "tile.spirefloor", "SAND": "tile.sand", "LEDGE": "tile.ledge",
    "SLOPE_UP_LEFT": "tile.slope_up_left", "SLOPE_UP_RIGHT": "tile.slope_up_right",
    "TRIGGER": "tile.trigger",
}

ENEMY_KEY_BY_TYPE = {
    "wraith": "enemy.wraith", "sentinel": "enemy.sentinel",
    "adept": "enemy.adept", "boss": "enemy.boss",
}

ITEM_KEY_BY_TYPE = {"shard": "item.shard", "potion": "item.potion"}
```

Note: `palette_hint` is carried in the catalog for documentation/driver use;
Task 7's driver script is responsible for actually applying it (human/
creature generators pick their own internal palettes per seed today — Task
7 documents exactly how the hint is threaded through, since `human.py`
doesn't currently accept a full palette override, only individual `skin`/
`hair`/`top` cosine-palette component draws seeded internally. Applying a
named override consistently is scoped as the driver script's job, not a
further generator patch, to keep this plan's generator-patch surface
minimal — see Task 7 Step 2).

- [ ] **Step 2: Write and run the catalog test**

Create `tools/spritegen/catalog_test.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from catalog import CATALOG, TILE_KEY_BY_T_NAME, ENEMY_KEY_BY_TYPE, ITEM_KEY_BY_TYPE  # noqa: E402

EXPECTED_TILE_NAMES = {
    "GRASS", "DGRASS", "PATH", "WATER", "TREE", "ROCK", "RFLOOR", "RWALL",
    "CRYSTAL", "FLOWER", "BRIDGE", "GRAVE", "BONES", "TALLGRASS",
    "SPIREFLOOR", "SAND", "LEDGE", "SLOPE_UP_LEFT", "SLOPE_UP_RIGHT", "TRIGGER",
}
EXPECTED_ENEMY_TYPES = {"wraith", "sentinel", "adept", "boss"}
EXPECTED_ITEM_TYPES = {"shard", "potion"}


def main():
    assert set(TILE_KEY_BY_T_NAME) == EXPECTED_TILE_NAMES, TILE_KEY_BY_T_NAME.keys()
    assert set(ENEMY_KEY_BY_TYPE) == EXPECTED_ENEMY_TYPES
    assert set(ITEM_KEY_BY_TYPE) == EXPECTED_ITEM_TYPES

    for mapping in (TILE_KEY_BY_T_NAME, ENEMY_KEY_BY_TYPE, ITEM_KEY_BY_TYPE):
        for key in mapping.values():
            assert key in CATALOG, f"{key} referenced but missing from CATALOG"
    assert "player" in CATALOG

    print("OK:", len(CATALOG), "catalog entries")


if __name__ == "__main__":
    main()
```

Run: `python3 tools/spritegen/catalog_test.py`
Expected: `OK: 27 catalog entries` (20 tiles + 4 enemies + 2 items + player).

- [ ] **Step 3: Commit**

```bash
git add tools/spritegen/catalog.py tools/spritegen/catalog_test.py
git commit -m "Add eldrinth entity catalog for sprite generation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Write the batch driver script

**Files:**
- Create: `tools/spritegen/gen_sprites.py`
- Test: manual run against `src/assets/sprites/` (Step 3 below)

**Interfaces:**
- Consumes: `CATALOG` (Task 6), `get_generator` (Task 1), `Sprite.image`/`Sprite.to_dict()` (base.py).
- Produces: for every catalog entry, a directory `src/assets/sprites/<key>/` containing `sheet.png` and `manifest.json`. `manifest.json` shape (consumed by `spriteAtlas.ts` in Task 9):
  ```json
  {
    "kind": "human" | "creature" | "item" | "tile",
    "cellW": 32, "cellH": 32,
    "directions": ["front", "right", "back", "left"],
    "actions": {
      "walk": {"row": 0, "frames": 4},
      "attack": {"row": 1, "frames": 4}
    },
    "static": false
  }
  ```
  For static kinds (`item`, `tile`) manifest is `{"kind": ..., "cellW": ..., "cellH": ..., "static": true}` and `sheet.png` is a single frame (plus, for autotiled tiles, 16 mask frames laid out left-to-right — see Step 2).

- [ ] **Step 1: Write the driver for animated kinds (human/creature)**

Create `tools/spritegen/gen_sprites.py`:

```python
"""Batch-generate every sprite in CATALOG into src/assets/sprites/.

Dev-time only. Run via `npm run gen:sprites` (see package.json), never
invoked by the shipped game.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from catalog import CATALOG  # noqa: E402
from generator.registry import get_generator  # noqa: E402
from generator.sprites.tile import TileSpriteGenerator  # noqa: E402
from generator import sheet as sheetmod  # noqa: E402

OUT_ROOT = HERE.parent.parent / "src" / "assets" / "sprites"


def _write(out_dir: Path, image, manifest: dict):
    out_dir.mkdir(parents=True, exist_ok=True)
    image.save(out_dir / "sheet.png")
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))


def gen_animated(key: str, entry: dict):
    kind = entry["kind"]  # "human" | "creature"
    gen = get_generator(kind)
    gen_kwargs = {}
    if kind == "creature" and "archetype" in entry:
        gen_kwargs["archetype"] = entry["archetype"]

    directions = ["front", "right", "back", "left"]
    actions = entry.get("anims", ["walk"])
    frames_per_action = 4

    action_sheets = []
    action_meta = {}
    row = 0
    for action in actions:
        sprites = []
        for d in directions:
            sprites.extend(
                gen.generate_walk(
                    entry["seed"], direction=d, frames=frames_per_action,
                    action=action, **gen_kwargs,
                )
            )
        action_sheets.append(sprites)
        action_meta[action] = {"row": row, "frames": frames_per_action}
        row += 1

    # Stack each action's (directions x frames) block into one tall sheet:
    # rows = len(actions) * len(directions), cols = frames_per_action.
    all_sprites = [s for block in action_sheets for s in block]
    img, sheet_meta = sheetmod.make_sheet(
        all_sprites, cols=frames_per_action, margin=1, transparent=True,
    )

    manifest = {
        "kind": kind,
        "cellW": sheet_meta["cell_size"],
        "cellH": sheet_meta["cell_size"],
        "directions": directions,
        "actions": action_meta,
        "static": False,
    }
    _write(OUT_ROOT / key, img, manifest)
    print(f"  {key}: {img.size[0]}x{img.size[1]} ({len(actions)} action(s))")


def gen_static(key: str, entry: dict):
    kind = entry["kind"]  # "item" | "tile"
    if kind == "tile" and entry.get("autotile"):
        gen_autotile_static(key, entry)
        return
    if kind == "tile":
        gen = TileSpriteGenerator()
        sprite = gen.generate(entry["seed"], kind=entry.get("tile_kind"))
    else:
        gen = get_generator(kind)
        sprite = gen.generate(entry["seed"])

    manifest = {
        "kind": kind,
        "cellW": sprite.size[0],
        "cellH": sprite.size[1],
        "static": True,
    }
    _write(OUT_ROOT / key, sprite.image, manifest)
    print(f"  {key}: {sprite.size[0]}x{sprite.size[1]} (static)")


def gen_autotile_static(key: str, entry: dict):
    """16-mask Wang tileset laid out left-to-right in one row."""
    gen = TileSpriteGenerator()
    sprites = [gen.generate(entry["seed"], kind=entry.get("tile_kind"), mask=m) for m in range(16)]
    img, sheet_meta = sheetmod.make_sheet(sprites, cols=16, margin=0, transparent=True)
    manifest = {
        "kind": "tile",
        "cellW": sheet_meta["cell_size"],
        "cellH": sheet_meta["cell_size"],
        "static": True,
        "autotile": True,
        "masks": 16,
    }
    _write(OUT_ROOT / key, img, manifest)
    print(f"  {key}: {img.size[0]}x{img.size[1]} (16-mask autotile)")


def main():
    print(f"Generating {len(CATALOG)} catalog entries into {OUT_ROOT}")
    for key, entry in CATALOG.items():
        if entry["kind"] in ("human", "creature"):
            gen_animated(key, entry)
        else:
            gen_static(key, entry)
    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Note the palette-hint gap and resolve it**

`palette_hint` in the catalog (Task 6) isn't consumed by `gen_animated`/
`gen_static` above, because neither `human.py` nor `creature.py` accepts a
single named-palette override for the whole sprite today — each picks its
own internal cosine palette per seed/body-part (skin/hair/cloth for humans;
base/accent for creatures, keyed off `_PALETTE_FOR[archetype]`). Getting a
dark-fantasy *look* for this pass comes from: (a) the `tile`/`item`
generators, which DO take a plain palette name (`TileSpriteGenerator`'s
`kind=` maps to a fixed palette internally — extend `_PALETTE_FOR`-style
dicts in `tile.py`/`item.py` if a closer match is wanted, which is a
reasonable follow-up but not required for this pass to function), and (b)
the seed strings themselves combined with the archetype/palette choices
already baked into `creature.py`'s `_PALETTE_FOR` (e.g. `golem → "stone"`,
`tentacle → "water"`), which is why Task 6's catalog picks archetypes whose
built-in palette already leans toward the intended tone. Leave
`palette_hint` in the catalog as documentation of intent for now; do not
block this task on wiring a full override — that is out of scope per the
spec's YAGNI direction (ship the pipeline first, tune per-entity palettes
as a fast follow once art is visible in-game).

- [ ] **Step 3: Run the driver and inspect output**

```bash
cd /home/damien/Projects/eldrinth
pip install -r tools/spritegen/requirements.txt
python3 tools/spritegen/gen_sprites.py
```

Expected: 27 lines of `  <key>: WxH (...)` output, then `Done.`, and
`src/assets/sprites/` now contains one directory per catalog key, each with
`sheet.png` + `manifest.json`. Spot-check by opening 2-3 PNGs
(`tile.water/sheet.png`, `player/sheet.png`, `enemy.sentinel/sheet.png`) in
an image viewer to confirm they're non-empty, non-corrupt pixel art.

- [ ] **Step 4: Commit the driver script and generated assets**

```bash
git add tools/spritegen/gen_sprites.py src/assets/sprites
git commit -m "Add batch sprite-generation driver script and generate initial assets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire `npm run gen:sprites`

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run gen:sprites` runs Task 7's driver script.

- [ ] **Step 1: Add the script**

In `package.json`, add to `"scripts"`:

```json
    "gen:sprites": "python3 tools/spritegen/gen_sprites.py"
```

- [ ] **Step 2: Verify it runs**

Run: `npm run gen:sprites`
Expected: same output as Task 7 Step 3 (idempotent — pixel content is
identical since generation is deterministic; running it again produces byte-
identical PNGs).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "Add npm run gen:sprites script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Sprite atlas loader

**Files:**
- Create: `src/game/render/spriteAtlas.ts`
- Test: `src/game/render/spriteAtlas.test.ts`

**Interfaces:**
- Consumes: the `manifest.json` shape produced in Task 7, and Vite's static asset URL imports (`import sheetUrl from "@/assets/sprites/player/sheet.png"` pattern — see Step 1 for why a URL-map approach is used instead of one import per asset).
- Produces:
  ```typescript
  export interface FrameRect { sx: number; sy: number; sw: number; sh: number }
  export interface SpriteAtlas {
    ready: boolean;
    image: HTMLImageElement | null;
    getFrame(direction: string, action: string, frame: number): FrameRect | null;
    getStaticFrame(maskOrIndex?: number): FrameRect | null;
  }
  export function loadAtlas(entityKey: string): SpriteAtlas;
  export function preloadAtlases(entityKeys: string[]): Promise<void>;
  ```

- [ ] **Step 1: Write the loader**

Vite's `import.meta.glob` lets us load every generated sprite folder without
hand-writing one `import` per entity. Create `src/game/render/spriteAtlas.ts`:

```typescript
export interface FrameRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface ActionMeta {
  row: number;
  frames: number;
}

interface Manifest {
  kind: "human" | "creature" | "item" | "tile";
  cellW: number;
  cellH: number;
  directions?: string[];
  actions?: Record<string, ActionMeta>;
  static: boolean;
  autotile?: boolean;
  masks?: number;
}

export interface SpriteAtlas {
  ready: boolean;
  image: HTMLImageElement | null;
  getFrame(direction: string, action: string, frame: number): FrameRect | null;
  getStaticFrame(maskOrIndex?: number): FrameRect | null;
}

const sheetUrls = import.meta.glob("@/assets/sprites/*/sheet.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const manifests = import.meta.glob("@/assets/sprites/*/manifest.json", {
  eager: true,
  import: "default",
}) as Record<string, Manifest>;

function keyFromPath(path: string): string {
  // "@/assets/sprites/enemy.wraith/sheet.png" -> "enemy.wraith"
  const parts = path.split("/");
  return parts[parts.length - 2];
}

const urlByKey = new Map<string, string>();
for (const [path, url] of Object.entries(sheetUrls)) urlByKey.set(keyFromPath(path), url);

const manifestByKey = new Map<string, Manifest>();
for (const [path, manifest] of Object.entries(manifests)) manifestByKey.set(keyFromPath(path), manifest);

const cache = new Map<string, SpriteAtlas>();

export function loadAtlas(entityKey: string): SpriteAtlas {
  const cached = cache.get(entityKey);
  if (cached) return cached;

  const manifest = manifestByKey.get(entityKey);
  const url = urlByKey.get(entityKey);
  const atlas: SpriteAtlas = {
    ready: false,
    image: null,
    getFrame(direction, action, frame) {
      if (!atlas.ready || !manifest?.actions || !manifest.directions) return null;
      const actionMeta = manifest.actions[action];
      if (!actionMeta) return null;
      const dirIndex = manifest.directions.indexOf(direction);
      if (dirIndex < 0) return null;
      const row = actionMeta.row * manifest.directions.length + dirIndex;
      const col = frame % actionMeta.frames;
      return {
        sx: col * manifest.cellW,
        sy: row * manifest.cellH,
        sw: manifest.cellW,
        sh: manifest.cellH,
      };
    },
    getStaticFrame(maskOrIndex = 0) {
      if (!atlas.ready || !manifest) return null;
      return {
        sx: maskOrIndex * manifest.cellW,
        sy: 0,
        sw: manifest.cellW,
        sh: manifest.cellH,
      };
    },
  };

  if (manifest && url) {
    const img = new Image();
    img.onload = () => {
      atlas.image = img;
      atlas.ready = true;
    };
    img.onerror = () => {
      // Development safety net only — every catalog entry ships a
      // generated asset (Task 12 enforces this in CI), so this path
      // should never be hit for shipped content.
      console.error(`Failed to load sprite atlas for "${entityKey}" at ${url}`);
    };
    img.src = url;
  } else {
    console.error(`No generated sprite assets found for "${entityKey}" — run npm run gen:sprites`);
  }

  cache.set(entityKey, atlas);
  return atlas;
}

export async function preloadAtlases(entityKeys: string[]): Promise<void> {
  const atlases = entityKeys.map(loadAtlas);
  await Promise.all(
    atlases.map(
      (atlas) =>
        new Promise<void>((resolve) => {
          if (atlas.ready) return resolve();
          const check = () => {
            if (atlas.ready || !atlas.image) return resolve();
            requestAnimationFrame(check);
          };
          check();
        }),
    ),
  );
}
```

- [ ] **Step 2: Write frame-lookup tests against a fake manifest**

Create `src/game/render/spriteAtlas.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { FrameRect } from "./spriteAtlas";

// getFrame's math is pure given a manifest + ready state, so test the
// row/col arithmetic directly rather than mocking Vite's import.meta.glob.
function computeFrame(
  manifest: {
    cellW: number;
    cellH: number;
    directions: string[];
    actions: Record<string, { row: number; frames: number }>;
  },
  direction: string,
  action: string,
  frame: number,
): FrameRect | null {
  const actionMeta = manifest.actions[action];
  if (!actionMeta) return null;
  const dirIndex = manifest.directions.indexOf(direction);
  if (dirIndex < 0) return null;
  const row = actionMeta.row * manifest.directions.length + dirIndex;
  const col = frame % actionMeta.frames;
  return { sx: col * manifest.cellW, sy: row * manifest.cellH, sw: manifest.cellW, sh: manifest.cellH };
}

const manifest = {
  cellW: 32,
  cellH: 32,
  directions: ["front", "right", "back", "left"],
  actions: { walk: { row: 0, frames: 4 }, attack: { row: 1, frames: 4 } },
};

describe("sprite frame lookup", () => {
  it("computes the first frame of the first direction at the origin", () => {
    expect(computeFrame(manifest, "front", "walk", 0)).toEqual({ sx: 0, sy: 0, sw: 32, sh: 32 });
  });

  it("offsets rows by direction index within an action", () => {
    expect(computeFrame(manifest, "back", "walk", 0)).toEqual({ sx: 0, sy: 32 * 2, sw: 32, sh: 32 });
  });

  it("offsets rows by action.row * direction count", () => {
    expect(computeFrame(manifest, "front", "attack", 0)).toEqual({ sx: 0, sy: 32 * 4, sw: 32, sh: 32 });
  });

  it("wraps frame index by the action's frame count", () => {
    expect(computeFrame(manifest, "front", "walk", 5)).toEqual(computeFrame(manifest, "front", "walk", 1));
  });

  it("returns null for an unknown action", () => {
    expect(computeFrame(manifest, "front", "idle", 0)).toBeNull();
  });

  it("returns null for an unknown direction", () => {
    expect(computeFrame(manifest, "diagonal", "walk", 0)).toBeNull();
  });
});
```

Run: `npx vitest run src/game/render/spriteAtlas.test.ts`
Expected: 6 passing tests.

- [ ] **Step 3: Commit**

```bash
git add src/game/render/spriteAtlas.ts src/game/render/spriteAtlas.test.ts
git commit -m "Add sprite atlas loader for generated pixel-art assets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Switch tile rendering to sprites

**Files:**
- Modify: `src/game/render/renderer.ts:160-411` (`drawTile`), `:68-157` (`TileChunkRenderer`)

**Interfaces:**
- Consumes: `loadAtlas`/`FrameRect` from Task 9's `spriteAtlas.ts`; `T` from `constants.ts`.
- Produces: `drawTile` keeps its exact signature `(ctx, t, x, y, seedX, seedY)` so `TileChunkRenderer` (its only caller) needs no interface change — only its body changes from vector fills to `drawImage`.

- [ ] **Step 1: Add a tile-key lookup and atlas preload**

At the top of `renderer.ts`, add:

```typescript
import { loadAtlas, type SpriteAtlas } from "./spriteAtlas";

const TILE_SPRITE_KEY: Record<number, string> = {
  [T.GRASS]: "tile.grass", [T.DGRASS]: "tile.dgrass", [T.PATH]: "tile.path",
  [T.WATER]: "tile.water", [T.TREE]: "tile.tree", [T.ROCK]: "tile.rock",
  [T.RFLOOR]: "tile.rfloor", [T.RWALL]: "tile.rwall", [T.CRYSTAL]: "tile.crystal",
  [T.FLOWER]: "tile.flower", [T.BRIDGE]: "tile.bridge", [T.GRAVE]: "tile.grave",
  [T.BONES]: "tile.bones", [T.TALLGRASS]: "tile.tallgrass",
  [T.SPIREFLOOR]: "tile.spirefloor", [T.SAND]: "tile.sand", [T.LEDGE]: "tile.ledge",
  [T.SLOPE_UP_LEFT]: "tile.slope_up_left", [T.SLOPE_UP_RIGHT]: "tile.slope_up_right",
  [T.TRIGGER]: "tile.trigger",
};

const tileAtlases = new Map<number, SpriteAtlas>();
function tileAtlasFor(tile: number): SpriteAtlas | null {
  const key = TILE_SPRITE_KEY[tile];
  if (!key) return null;
  let atlas = tileAtlases.get(tile);
  if (!atlas) {
    atlas = loadAtlas(key);
    tileAtlases.set(tile, atlas);
  }
  return atlas;
}
```

This mirrors the exact keys written by Task 6's `TILE_KEY_BY_T_NAME` — keep
these two lists in sync (Task 12's completeness test catches drift on the
Python/catalog side; this TS-side map is exercised the moment any tile
fails to render, since `tileAtlasFor` returning `null` falls through to the
existing flat-fill `default` case below).

- [ ] **Step 2: Replace `drawTile`'s body with sprite drawing + flat-fill fallback**

Replace the whole `drawTile` function body (the `switch (t) { ... }` and its
40+ cases) with:

```typescript
export function drawTile(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, seedX = x, seedY = y) {
  const s = TILE;
  const atlas = tileAtlasFor(t);
  if (atlas?.ready && atlas.image) {
    const frame = atlas.getStaticFrame(0);
    if (frame) {
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlas.image, frame.sx, frame.sy, frame.sw, frame.sh, x, y, s, s);
      ctx.imageSmoothingEnabled = prevSmoothing;
      return;
    }
  }
  // Fallback while an atlas is still loading (or, in dev, missing): the
  // original flat fill keeps the game playable instead of showing a hole.
  const r = hash2(seedX, seedY);
  void r;
  ctx.fillStyle = "#1b2a17";
  ctx.fillRect(x, y, s, s);
}
```

Note: this intentionally drops the old per-tile procedural jitter/detail
code (grass speckles, water ripple strokes, tree canopy, etc.) — that
detail now lives in the generated sprite pixels themselves. The `hash2`
import and `dot`/`rr` helpers may now be unused in this file; if so, remove
those now-dead imports (check with the compiler/linter after this change,
per Task 11's build verification).

- [ ] **Step 3: Preload tile atlases once at renderer/game startup**

Find where `TileChunkRenderer` is constructed (search `new TileChunkRenderer(` in `src/game/engine.ts`) and, right after construction, preload every tile key used by the current map so the first frames aren't drawn before atlases are ready:

```typescript
import { preloadAtlases } from "./render/spriteAtlas";
// ... near the TileChunkRenderer construction:
void preloadAtlases(Object.values(TILE_SPRITE_KEY));
```

(`TILE_SPRITE_KEY` needs to be exported from `renderer.ts` for this import
to work: add `export` to its declaration in Step 1.)

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open the game, walk around.
Expected: tiles render as pixel art (once `npm run gen:sprites` output from
Task 7 exists) instead of flat vector fills; no console errors about
missing atlases for any tile type actually placed on the map.

- [ ] **Step 5: Commit**

```bash
git add src/game/render/renderer.ts src/game/engine.ts
git commit -m "Render tiles from generated sprite atlases instead of vector fills

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Switch player/enemy rendering to sprites

**Files:**
- Modify: `src/game/render/renderer.ts:611-947` (`drawEnemy`, `drawWraith`, `drawSentinel`, `drawAdept`, `drawBoss`, `drawPlayer`, `drawKnightBody`)

**Interfaces:**
- Consumes: `loadAtlas`/`FrameRect` (Task 9); existing `EnemyState`/`PlayerState` fields already used by these functions (`e.type`, `e.dir` — confirm this field exists on `EnemyState`/read from `WorldState.ts` if not already visible in scope — `e.t` (elapsed time), `e.attacking`/`p.attacking`, `p.dir`, `p.walkT`).
- Produces: `drawKnightBody`, `drawWraith`, `drawSentinel`, `drawAdept`, `drawBoss` keep their existing call sites in `drawEnemy`/`drawPlayer` unchanged in signature, only their bodies change to `drawImage`.

- [ ] **Step 1: Add an entity-sprite drawing helper**

Add near the tile helpers from Task 10:

```typescript
const ENTITY_SPRITE_KEY: Record<string, string> = {
  player: "player",
  wraith: "enemy.wraith",
  sentinel: "enemy.sentinel",
  adept: "enemy.adept",
  boss: "enemy.boss",
};

const entityAtlases = new Map<string, SpriteAtlas>();
function entityAtlasFor(entityKey: string): SpriteAtlas {
  let atlas = entityAtlases.get(entityKey);
  if (!atlas) {
    atlas = loadAtlas(entityKey);
    entityAtlases.set(entityKey, atlas);
  }
  return atlas;
}

/** Draws one animated entity frame centered at the current transform origin. */
function drawEntitySprite(
  ctx: CanvasRenderingContext2D,
  entityKey: string,
  direction: string,
  action: string,
  animT: number,
  fps: number,
  drawSize: number,
): boolean {
  const atlas = entityAtlasFor(ENTITY_SPRITE_KEY[entityKey] ?? entityKey);
  if (!atlas.ready || !atlas.image) return false;
  const frameIndex = Math.floor(animT * fps);
  const frame = atlas.getFrame(direction, action, frameIndex);
  if (!frame) return false;
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas.image, frame.sx, frame.sy, frame.sw, frame.sh,
    -drawSize / 2, -drawSize / 2, drawSize, drawSize,
  );
  ctx.imageSmoothingEnabled = prevSmoothing;
  return true;
}
```

- [ ] **Step 2: Wire `drawKnightBody`**

Replace `drawKnightBody`'s body (all the `fillStyle`/`beginPath` calls) with:

```typescript
function drawKnightBody(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const action = p.attacking ? "attack" : "walk";
  const animT = p.attacking ? p.attackDur - p.attackTimer : p.walkT / (Math.PI * 2);
  const drawn = drawEntitySprite(ctx, "player", p.dir, action, animT, 8, TILE * 1.5);
  if (drawn) return;
  // Fallback: keep the original vector knight so a missing/loading atlas
  // never renders a blank player.
  const hurt = p.hurtFlash > 0;
  ctx.fillStyle = hurt ? "#ffd0d0" : "#16323e";
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(-11, 8, -7, 12);
  ctx.lineTo(7, 12);
  ctx.quadraticCurveTo(11, 8, 0, -2);
  ctx.fill();
}
```

Keep only the simplified silhouette above in the fallback branch (not the
full original ~50-line body) — it's a development safety net for a
not-yet-loaded atlas, not a permanent second art style; Task 12's
completeness check ensures the real sprite is always present by ship time.

- [ ] **Step 3: Wire `drawWraith`, `drawSentinel`, `drawAdept`, `drawBoss`**

Each of these currently draws in the enemy's local (translated) space — keep
that calling convention. Replace each function's body with the same
pattern as `drawKnightBody`, e.g. for `drawWraith`:

```typescript
function drawWraith(ctx: CanvasRenderingContext2D, e: EnemyState) {
  const action = e.telegraph ? "attack" : "walk";
  const animT = e.t;
  const drawn = drawEntitySprite(ctx, "wraith", "front", action, animT, 8, e.r * 2.2);
  if (drawn) return;
  ctx.fillStyle = e.hurt > 0 ? "#ffffff" : "rgba(150,225,180,0.6)";
  ctx.beginPath();
  ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  ctx.fill();
}
```

Repeat the same shape (call `drawEntitySprite` with the matching entity key
`"sentinel"`/`"adept"`/`"boss"`, `e.r`-derived draw size, `action =
e.telegraph ? "attack" : "walk"`, `animT = e.t`) for `drawSentinel`,
`drawAdept`, and `drawBoss`, each keeping only a minimal one-shape fallback
(a filled circle/rect in the entity's original base color) rather than
their full original bodies. `EnemyState` doesn't carry a facing direction
today (confirm via `src/game/core/WorldState.ts`) — pass `"front"` as a
fixed direction for enemies in this pass; giving enemies real directional
facing is a reasonable follow-up, not required for sprites to render.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, engage an enemy in combat.
Expected: player and enemies render as animated pixel-art sprites; attacking
visibly switches to the attack animation; no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/render/renderer.ts
git commit -m "Render player and enemies from generated sprite atlases

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Drop the single-file build constraint

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (remove `vite-plugin-singlefile` dependency)
- Modify: `ROADMAP.md`

**Interfaces:** none (build config only).

- [ ] **Step 1: Remove the plugin from Vite config**

In `vite.config.ts`, remove the import and usage:

```diff
-import { viteSingleFile } from "vite-plugin-singlefile";
```
```diff
-  plugins: [react(), tailwindcss(), viteSingleFile()],
+  plugins: [react(), tailwindcss()],
```

- [ ] **Step 2: Remove the dependency**

```bash
npm uninstall vite-plugin-singlefile
```

- [ ] **Step 3: Update ROADMAP.md**

Find the line "Keep the browser-only, single-file build" (or equivalent) in
`ROADMAP.md` and replace it with a note that the constraint was
deliberately dropped:

```markdown
- Browser-only build (dropped the single-file constraint to ship real
  sprite/tile image assets — see docs/superpowers/specs/2026-09-12-procedural-sprite-pipeline-design.md).
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: succeeds, and `dist/` now contains separate `.png`/`.js`/`.css`
files (not one single `index.html` with everything inlined).

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json ROADMAP.md
git commit -m "Drop single-file build constraint for sprite asset pipeline

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Catalog-completeness test

**Files:**
- Create: `src/game/render/spriteCatalog.test.ts`

**Interfaces:**
- Consumes: `T`/`TileType` from `src/game/constants.ts`, the exported
  `TILE_SPRITE_KEY` from `src/game/render/renderer.ts` (Task 10 Step 1 — this
  test imports it rather than redefining it, so the test actually catches
  drift if `renderer.ts`'s map ever falls out of sync with `T`), and the
  generated `src/assets/sprites/*/manifest.json` files on disk.

- [ ] **Step 1: Write the completeness test**

Create `src/game/render/spriteCatalog.test.ts`:

```typescript
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { T } from "../constants";
import { TILE_SPRITE_KEY } from "./renderer";

const SPRITES_ROOT = resolve(__dirname, "../../assets/sprites");

const ENTITY_KEYS = ["player", "enemy.wraith", "enemy.sentinel", "enemy.adept", "enemy.boss", "item.shard", "item.potion"];

function assetExists(key: string): boolean {
  return existsSync(resolve(SPRITES_ROOT, key, "sheet.png")) && existsSync(resolve(SPRITES_ROOT, key, "manifest.json"));
}

describe("sprite catalog completeness", () => {
  it("has a generated asset for every T tile value", () => {
    for (const [tName, tValue] of Object.entries(T)) {
      const key = TILE_SPRITE_KEY[tValue];
      expect(key, `T.${tName} has no entry in TILE_SPRITE_KEY`).toBeDefined();
      expect(assetExists(key), `T.${tName} -> "${key}" has no generated asset at ${SPRITES_ROOT}/${key}`).toBe(true);
    }
  });

  it("has a generated asset for every player/enemy/item entity", () => {
    for (const key of ENTITY_KEYS) {
      expect(assetExists(key), `"${key}" has no generated asset at ${SPRITES_ROOT}/${key}`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/game/render/spriteCatalog.test.ts`
Expected: 2 passing tests (assuming Task 7's `npm run gen:sprites` has been
run and its output committed). If it fails, that means an asset is missing
— run `npm run gen:sprites` again and re-commit `src/assets/sprites/`.

- [ ] **Step 3: Commit**

```bash
git add src/game/render/spriteCatalog.test.ts
git commit -m "Add CI test asserting every tile/entity has a generated sprite asset

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Full test suite and manual playthrough

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the pre-existing
`WorldState.test.ts`/`AISystem.test.ts`/`GameFlowSystem.test.ts`/
`regions.test.ts`/`map.test.ts`/`quests.test.ts` (untouched by this plan)
alongside the new `spriteAtlas.test.ts` and `spriteCatalog.test.ts`.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors, build succeeds.

- [ ] **Step 3: Manual playthrough**

Run: `npm run dev`, then play through: title screen → into a region with
several different tile types → fight each enemy type → pick up a shard and
a potion. Confirm every tile type and entity renders as pixel art (not a
flat-color fallback rect), walk/attack animations play, and there are no
console errors.

- [ ] **Step 4: Final commit if any fixes were needed**

If manual verification surfaced any bugs, fix them and commit:

```bash
git add -A
git commit -m "Fix issues found during sprite pipeline manual verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
