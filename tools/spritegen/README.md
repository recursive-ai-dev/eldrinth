# spritegen (vendored)

Adapted from the local `shed-dev-sprites` project. It is a fully offline,
deterministic, mathematical pixel-art generator: no network calls, models, or
runtime service are involved.

This copy is development tooling only. It writes the committed PNG and JSON
assets under `src/assets/sprites/` and is never imported by the browser build.
It requires Python 3.10+, Pillow, and numpy.

Regenerate the existing world atlases with `npm run gen:sprites`.

The generator retains its upstream Apache-2.0 license; see `LICENSE` in this folder.

Equipment and lantern icons are generated separately from the local sibling
`shed-dev-sprites` checkout, preserving the existing world atlases:

```sh
python3 tools/spritegen/gen_equipment_icons.py
python3 tools/spritegen/gen_equipment_icons.py --check
```

Use `--source /path/to/shed-dev-sprites` when the checkout is elsewhere. This
offline script requires Python 3.10+ and Pillow. It reads the source without
modifying it, writes its seven PNGs, manifest, and attribution under
`src/assets/equipment/`, and copies the attribution to
`public/third-party/equipment/` for browser and desktop distributions. The icons use the
upstream item and lantern prop generators without image postprocessing. The
manifest records each recipe, the upstream revision, a fingerprint of the
generator sources, and SHA-256 hashes for both PNG files and raw RGBA pixels.
`--check` regenerates in memory, checks determinism, transparency, distinct
images and committed pixels, and verifies that the manifest and both copies of
the attribution match the source.
Pixel checks are independent of PNG compression differences between Pillow
versions. No Python runs in the game.

The ordinary `npm test` suite also checks the complete equipment icon set,
PNG dimensions and file hashes against the committed manifest. Those integrity
checks run in CI without Python or the sibling checkout. The local
`npm run verify:equipment` command additionally verifies the generator recipes
and source provenance; it requires the sibling project and Pillow.

Field-guide and atlas imagery uses the separate `gen_field_kit.py` script
(`npm run gen:field-kit` / `npm run verify:field-kit`). Its 24 PNGs, manifest,
license, and notice live under `src/assets/field-kit/`. The generator also writes
and verifies identical notice and license copies in `public/third-party/field-kit/`.
Vite includes both public attribution directories in `dist/`, and the Debian
packager carries them with the game assets.
