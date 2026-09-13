"""Smoke test: the vendored generator remains deterministic."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.registry import get_generator  # noqa: E402


def main():
    gen = get_generator("human")
    first = gen.generate(seed=42)
    second = gen.generate(seed=42)
    assert first.pixel_hash == second.pixel_hash
    assert first.size == (32, 32)
    print("OK:", first.pixel_hash)


if __name__ == "__main__":
    main()
