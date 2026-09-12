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
