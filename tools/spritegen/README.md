# spritegen (vendored)

Adapted from the local `shed-dev-sprites` project. It is a fully offline,
deterministic, mathematical pixel-art generator: no network calls, models, or
runtime service are involved.

This copy is development tooling only. It writes the committed PNG and JSON
assets under `src/assets/sprites/` and is never imported by the browser build.
It requires Python 3.10+, Pillow, and numpy.

Regenerate all game art with `npm run gen:sprites`.

The generator retains its upstream MIT license; see `LICENSE` in this folder.
