# spritegen (vendored)

Adapted from `shed-dev-sprites` (https://github.com/... local project at
~/Projects/shed-dev-sprites) — a fully offline, deterministic, math-only
pixel-art sprite generator (no network calls, no ML models).

This copy is dev-tooling only: it generates the PNG/JSON assets committed
under `src/assets/sprites/` and is never imported by the shipped game.
Requires Python 3.10+, Pillow, numpy (`pip install -r requirements.txt`).

Regenerate all game art: `npm run gen:sprites`
