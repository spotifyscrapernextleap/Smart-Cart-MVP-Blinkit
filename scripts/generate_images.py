"""
generate_images.py — Smart Cart data prep, step 2 of 2.

Renders one 400x400 PNG per catalogue entry into public/images/{id}.png:
flat background coloured by tile, product name wrapped and centred in dark text,
brand name smaller beneath. Developer tool: run locally, once, after
reduce_catalogue.py. Never invoked by the app.

Usage:  python scripts/generate_images.py [--force]

Existing files are skipped unless --force is passed, so a re-run after a partial
catalogue change costs seconds rather than minutes.
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CATALOGUE_JSON = os.path.join(ROOT, "data", "catalogue.json")
OUT_DIR = os.path.join(ROOT, "public", "images")

SIZE = 400
MARGIN = 34
NAME_COLOR = (28, 32, 38)
BRAND_COLOR = (96, 104, 116)

# One background colour per tile, grouped so a section reads as a family:
# greens for Grocery, ambers for Snacks, pinks/purples for Beauty,
# blues/greys for Household, teal for Pet. Kept light so dark text stays legible.
TILE_COLORS = {
    "vegetables-fruits": (214, 240, 214),
    "atta-rice-dal": (232, 238, 209),
    "oil-ghee-masala": (240, 233, 201),
    "dairy-bread-eggs": (223, 240, 232),
    "bakery-biscuits": (240, 228, 208),
    "dry-fruits-cereals": (231, 226, 205),
    "chicken-meat-fish": (240, 219, 214),
    "kitchenware-appliances": (222, 234, 238),
    "chips-namkeen": (250, 231, 199),
    "sweets-chocolates": (238, 219, 206),
    "drinks-juices": (250, 236, 205),
    "tea-coffee-milk-drinks": (233, 222, 209),
    "instant-food": (247, 226, 210),
    "sauces-spreads": (243, 224, 216),
    "ice-creams-more": (232, 227, 243),
    "bath-body": (226, 234, 245),
    "hair": (235, 226, 243),
    "skin-face": (247, 226, 234),
    "beauty-cosmetics": (245, 220, 231),
    "feminine-hygiene": (240, 224, 238),
    "baby-care": (226, 238, 245),
    "health-pharma": (222, 238, 234),
    "home-lifestyle": (231, 232, 240),
    "cleaners-repellents": (219, 235, 242),
    "stationery-games": (228, 231, 236),
    "electronics": (224, 228, 234),
    "pet-store": (216, 237, 236),
}

FALLBACK_COLOR = (233, 235, 238)

FONT_CANDIDATES = [
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/calibri.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
FONT_BOLD_CANDIDATES = [
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/calibrib.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(candidates, size):
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def wrap(draw, text, font, max_width):
    """Greedy wrap on whitespace; hard-splits any single word that overflows."""
    lines = []
    line = ""
    for word in text.split():
        probe = (line + " " + word).strip()
        if draw.textlength(probe, font=font) <= max_width or not line:
            line = probe
        else:
            lines.append(line)
            line = word
        while draw.textlength(line, font=font) > max_width and len(line) > 1:
            cut = len(line) - 1
            while cut > 1 and draw.textlength(line[:cut], font=font) > max_width:
                cut -= 1
            lines.append(line[:cut])
            line = line[cut:]
    if line:
        lines.append(line)
    return lines


def main():
    force = "--force" in sys.argv

    with open(CATALOGUE_JSON, encoding="utf-8") as fh:
        catalogue = json.load(fh)

    os.makedirs(OUT_DIR, exist_ok=True)

    name_font = load_font(FONT_BOLD_CANDIDATES, 27)
    brand_font = load_font(FONT_CANDIDATES, 21)

    missing_colors = sorted(
        {p["tile"] for p in catalogue if p["tile"] not in TILE_COLORS}
    )
    if missing_colors:
        print("WARNING: no colour for tiles: {}".format(", ".join(missing_colors)))

    written = skipped = 0
    max_width = SIZE - 2 * MARGIN

    for product in catalogue:
        out_path = os.path.join(OUT_DIR, "{}.png".format(product["id"]))
        if not force and os.path.exists(out_path):
            skipped += 1
            continue

        bg = TILE_COLORS.get(product["tile"], FALLBACK_COLOR)
        img = Image.new("RGB", (SIZE, SIZE), bg)
        draw = ImageDraw.Draw(img)

        # The product name is the only content that varies in length; cap it at
        # six lines so a 90-character gourmet SKU cannot push the brand off-canvas.
        lines = wrap(draw, product["name"], name_font, max_width)
        if len(lines) > 6:
            lines = lines[:6]
            lines[-1] = lines[-1][: max(1, len(lines[-1]) - 1)] + "\u2026"

        line_h = name_font.size + 7
        brand_h = brand_font.size + 6
        block_h = len(lines) * line_h + 16 + brand_h
        y = (SIZE - block_h) // 2

        for line in lines:
            w = draw.textlength(line, font=name_font)
            draw.text(((SIZE - w) / 2, y), line, font=name_font, fill=NAME_COLOR)
            y += line_h

        y += 16
        brand = product["brand"]
        if draw.textlength(brand, font=brand_font) > max_width:
            brand = wrap(draw, brand, brand_font, max_width)[0]
        w = draw.textlength(brand, font=brand_font)
        draw.text(((SIZE - w) / 2, y), brand, font=brand_font, fill=BRAND_COLOR)

        img.save(out_path, "PNG", optimize=True)
        written += 1
        if written % 250 == 0:
            print("  {} written...".format(written), flush=True)

    print("\nwrote {} images, skipped {} existing".format(written, skipped))
    print("output: public/images/  ({} files)".format(len(os.listdir(OUT_DIR))))
    print("{} tiles coloured, one colour each".format(len(TILE_COLORS)))


if __name__ == "__main__":
    main()
