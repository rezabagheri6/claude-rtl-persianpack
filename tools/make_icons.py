#!/usr/bin/env python3
"""Generate the extension icons.

The mark is three right-aligned bars: a paragraph set flush right, which is the
one thing this extension does. Everything is drawn at 4x and downsampled, so
the 16px icon keeps clean edges.

    python tools/make_icons.py
"""

import pathlib
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow is required: python -m pip install pillow")

SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4

BACKGROUND = (217, 119, 87, 255)   # the warm terracotta Claude uses
BAR = (255, 252, 249, 255)

# Bar widths as a share of the icon, top to bottom. Uneven lengths read as
# text rather than as a menu glyph.
BAR_WIDTHS = (0.62, 0.44, 0.56)


def draw_icon(size):
    canvas = size * SUPERSAMPLE
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle(
        (0, 0, canvas - 1, canvas - 1),
        radius=canvas * 0.22,
        fill=BACKGROUND,
    )

    right = canvas * 0.80
    height = canvas * 0.093
    gap = canvas * 0.088
    total = len(BAR_WIDTHS) * height + (len(BAR_WIDTHS) - 1) * gap
    top = (canvas - total) / 2

    for width in BAR_WIDTHS:
        left = right - canvas * width
        draw.rounded_rectangle(
            (left, top, right, top + height),
            radius=height / 2,
            fill=BAR,
        )
        top += height + gap

    return image.resize((size, size), Image.LANCZOS)


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    out = root / "extension" / "icons"
    out.mkdir(parents=True, exist_ok=True)

    for size in SIZES:
        path = out / f"icon{size}.png"
        draw_icon(size).save(path, optimize=True)
        print(f"{path.relative_to(root)}  ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
