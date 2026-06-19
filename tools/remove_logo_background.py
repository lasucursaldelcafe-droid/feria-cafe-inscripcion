#!/usr/bin/env python3
"""Remove dark/near-black background from La Sucursal del Café logo PNG."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "assets" / "logo-la-sucursal-del-cafe.png"
DEFAULT_OUTPUT = ROOT / "assets" / "logo-la-sucursal-del-cafe.png"


def is_background_pixel(r: int, g: int, b: int, threshold: int = 44) -> bool:
    """Detect uniform dark background while preserving logo browns and colors."""
    peak = max(r, g, b)
    if peak > threshold:
        return False

    spread = max(r, g, b) - min(r, g, b)
    if spread <= 10:
        return True

    if peak <= 32 and spread <= 18:
        return True

    return False


def remove_dark_background(
    input_path: Path,
    output_path: Path,
    threshold: int = 44,
) -> None:
    image = Image.open(input_path).convert("RGBA")
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if is_background_pixel(r, g, b, threshold):
                pixels[x, y] = (r, g, b, 0)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, "PNG", optimize=True)
    print(f"Saved transparent logo: {output_path}")


def main() -> int:
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT

    if not input_path.exists():
        print(f"Input not found: {input_path}", file=sys.stderr)
        return 1

    remove_dark_background(input_path, output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
