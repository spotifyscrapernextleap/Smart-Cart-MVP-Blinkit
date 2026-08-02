"""
reduce_catalogue.py — Smart Cart data prep, step 1 of 2.

Reads scripts/Blinkit_Products.xlsx (27,555 rows) and writes data/catalogue.json
(~2,150 products). Developer tool: run locally, once. Never invoked by the app.

Pipeline order is fixed by the build spec section 6, Phase 0.1:
  1. drop rows with null product or brand
  2. drop duplicates on (product, brand)
  3. drop rows with sale_price < 5 or > 5000
  4. map sub_category -> tile id (unmapped sub-categories are dropped and printed)
  5. sample each tile down to targetCount, preferring rows whose brand appears
     most frequently in the source
  6. assign sequential ids
  7. assign bestsellerRank: 3 random bestsellers per tile, then brand order
  8. set isSearchable / isConsumable from tiles.json plus the override list below

Usage:  python scripts/reduce_catalogue.py
"""

import json
import os
import random
import sys

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SOURCE_XLSX = os.path.join(HERE, "Blinkit_Products.xlsx")
TILES_JSON = os.path.join(ROOT, "data", "tiles.json")
OUT_JSON = os.path.join(ROOT, "data", "catalogue.json")

MIN_PRICE = 5
MAX_PRICE = 5000

# Roughly how many SKUs each selected brand should contribute to a tile. Drives
# how wide the per-tile brand set is; see the sampling step for why it matters.
TARGET_PRODUCTS_PER_BRAND = 3

# Per tile, this many products are chosen at random to hold the top bestseller
# ranks; everything else keeps brand-frequency order beneath them. The source
# dump has no popularity column at all, so any ranking is a fiction — this one
# at least stops the panel leading with the same product on every run.
# Seeded, so the catalogue is reproducible.
BESTSELLER_COUNT = 3
BESTSELLER_SEED = 20260802

# Some source rows were encoding-damaged more than once; the repair re-runs
# until it stops changing the string.
MAX_MOJIBAKE_PASSES = 3

# ---------------------------------------------------------------------------
# sub_category -> tile id
#
# The source has 90 distinct sub_category values across 11 categories. A handful
# of names appear under more than one category ("Atta, Flours & Sooji" is under
# Foodgrains, Gourmet, Snacks and Baby Care); every such collision resolves to
# the same tile, so sub_category alone is a sufficient key.
#
# Anything absent from this dict is dropped and reported. There is no fallback
# bucket on purpose: a silently mis-binned sub-category would corrupt dormancy,
# never-bought and diversity logic downstream, which all operate on tiles.
# ---------------------------------------------------------------------------
SUBCATEGORY_TO_TILE = {
    # Grocery & Kitchen
    "Fresh Vegetables": "vegetables-fruits",
    "Fresh Fruits": "vegetables-fruits",
    "Cuts & Sprouts": "vegetables-fruits",
    "Exotic Fruits & Veggies": "vegetables-fruits",
    "Organic Fruits & Vegetables": "vegetables-fruits",
    "Herbs & Seasonings": "vegetables-fruits",
    "Atta, Flours & Sooji": "atta-rice-dal",
    "Rice & Rice Products": "atta-rice-dal",
    "Dals & Pulses": "atta-rice-dal",
    "Organic Staples": "atta-rice-dal",
    "Salt, Sugar & Jaggery": "atta-rice-dal",
    "Cooking & Baking Needs": "atta-rice-dal",
    "Masalas & Spices": "oil-ghee-masala",
    "Edible Oils & Ghee": "oil-ghee-masala",
    "Oils & Vinegar": "oil-ghee-masala",
    "Dairy": "dairy-bread-eggs",
    "Dairy & Cheese": "dairy-bread-eggs",
    "Non Dairy": "dairy-bread-eggs",
    "Breads & Buns": "dairy-bread-eggs",
    "Gourmet Breads": "dairy-bread-eggs",
    "Eggs": "dairy-bread-eggs",
    "Biscuits & Cookies": "bakery-biscuits",
    "Cookies, Rusk & Khari": "bakery-biscuits",
    "Cakes & Pastries": "bakery-biscuits",
    "Bakery Snacks": "bakery-biscuits",
    "Dry Fruits": "dry-fruits-cereals",
    "Breakfast Cereals": "dry-fruits-cereals",
    "Cereals & Breakfast": "dry-fruits-cereals",
    "Sausages, Bacon & Salami": "chicken-meat-fish",
    "Fish & Seafood": "chicken-meat-fish",
    "Mutton & Lamb": "chicken-meat-fish",
    "Pork & Other Meats": "chicken-meat-fish",
    "Marinades": "chicken-meat-fish",
    "Crockery & Cutlery": "kitchenware-appliances",
    "Cookware & Non Stick": "kitchenware-appliances",
    "Steel Utensils": "kitchenware-appliances",
    "Kitchen Accessories": "kitchenware-appliances",
    "Storage & Accessories": "kitchenware-appliances",
    "Bakeware": "kitchenware-appliances",
    "Flask & Casserole": "kitchenware-appliances",
    # Snacks & Drinks
    "Snacks & Namkeen": "chips-namkeen",
    "Snacks, Dry Fruits, Nuts": "chips-namkeen",
    "Chocolates & Candies": "sweets-chocolates",
    "Chocolates & Biscuits": "sweets-chocolates",
    "Indian Mithai": "sweets-chocolates",
    "Fruit Juices & Drinks": "drinks-juices",
    "Energy & Soft Drinks": "drinks-juices",
    "Water": "drinks-juices",
    "Tea": "tea-coffee-milk-drinks",
    "Coffee": "tea-coffee-milk-drinks",
    "Health Drink, Supplement": "tea-coffee-milk-drinks",
    # 736 rows, of which 335 are gourmet tea, 157 coffee and 80 health drinks.
    # Filed under tea rather than juices on that composition: sent to
    # drinks-juices it drowns the juice tile in loose-leaf Darjeeling.
    "Drinks & Beverages": "tea-coffee-milk-drinks",
    "Ready To Cook & Eat": "instant-food",
    "Pasta, Soup & Noodles": "instant-food",
    "Noodle, Pasta, Vermicelli": "instant-food",
    "Frozen Veggies & Snacks": "instant-food",
    "Tinned & Processed Food": "instant-food",
    "Sauces, Spreads & Dips": "sauces-spreads",
    "Spreads, Sauces, Ketchup": "sauces-spreads",
    "Pickles & Chutney": "sauces-spreads",
    "Ice Creams & Desserts": "ice-creams-more",
    # Beauty & Personal Care
    "Bath & Hand Wash": "bath-body",
    "Fragrances & Deos": "bath-body",
    "Men's Grooming": "bath-body",
    "Hair Care": "hair",
    "Skin Care": "skin-face",
    "Makeup": "beauty-cosmetics",
    "Feminine Hygiene": "feminine-hygiene",
    "Diapers & Wipes": "baby-care",
    "Baby Bath & Hygiene": "baby-care",
    "Baby Food & Formula": "baby-care",
    "Feeding & Nursing": "baby-care",
    "Baby Accessories": "baby-care",
    "Mothers & Maternity": "baby-care",
    "Health & Medicine": "health-pharma",
    "Oral Care": "health-pharma",
    # Household Essentials
    "Bins & Bathroom Ware": "home-lifestyle",
    "Pooja Needs": "home-lifestyle",
    "Party & Festive Needs": "home-lifestyle",
    "Gardening": "home-lifestyle",
    "Flower Bouquets, Bunches": "home-lifestyle",
    "All Purpose Cleaners": "cleaners-repellents",
    "Detergents & Dishwash": "cleaners-repellents",
    "Mops, Brushes & Scrubs": "cleaners-repellents",
    "Fresheners & Repellents": "cleaners-repellents",
    "Disposables, Garbage Bag": "cleaners-repellents",
    "Car & Shoe Care": "cleaners-repellents",
    "Stationery": "stationery-games",
    "Appliances & Electricals": "electronics",
    # Pet Store
    "Pet Food & Accessories": "pet-store",
}

# ---------------------------------------------------------------------------
# isConsumable overrides.
#
# consumableDefault comes from the tile. These keyword lists flip individual
# products the other way. This exists for one reason: the recommender excludes a
# durable the persona already owns from dormant candidates, and that rule is only
# observable if durables exist inside otherwise-consumable tiles. A steel pet bowl
# in pet-store is the canonical case.
#
# Matching is case-insensitive substring against the product name.
# ---------------------------------------------------------------------------
NON_CONSUMABLE_KEYWORDS = {
    "pet-store": [
        "bowl", "collar", "leash", "feeder", "brush", "toy", "cage", "kennel",
        "litter tray", "scoop", "harness", "muzzle", "comb", "clipper", "bed",
    ],
    "baby-care": [
        "bottle", "sipper", "teether", "breast pump", "sterilizer", "stroller",
        "high chair", "carrier", "thermometer", "nail cutter", "hair brush",
    ],
    "health-pharma": [
        "thermometer", "glucometer", "bp monitor", "nebulizer", "weighing scale",
        "hot water bag", "ice bag", "crutch", "wheelchair", "heating pad",
    ],
    "bath-body": [
        "razor", "trimmer", "shaver", "loofah", "sponge", "soap case",
        "shaving brush", "tweezer", "nail cutter",
    ],
    "hair": ["comb", "hair brush", "dryer", "straightener", "curler", "hair clip"],
    "beauty-cosmetics": ["brush set", "applicator", "puff", "mirror", "sharpener"],
    "cleaners-repellents": [
        "mop", "broom", "brush", "bucket", "wiper", "dustpan", "scrubber pad holder",
    ],
}

# Reverse case: products inside a non-consumable tile that are actually consumed.
CONSUMABLE_KEYWORDS = {
    "home-lifestyle": [
        "agarbatti", "incense", "dhoop", "camphor", "candle", "matchbox",
        "cotton wick", "kumkum", "havan", "oil lamp oil",
    ],
    "stationery-games": ["refill", "ink", "glue", "tape", "eraser", "sharpener"],
}


def log(msg=""):
    print(msg, flush=True)


# Whitespace-ish and unrenderable codepoints that must not reach the UI or get
# burnt into a generated product image.
_JUNK = dict.fromkeys(
    [0xFFFD, 0x00A0, 0x200B, 0x200C, 0x200D, 0xFEFF] + list(range(0x80, 0xA0)),
    " ",
)


def clean_text(value):
    """
    Repair mojibake, strip encoding junk, collapse whitespace.

    The source was written as UTF-8 and read back as a single-byte codec, so a
    non-breaking space arrives as the two characters "Â\xa0" and an en dash as
    "â€“". Removing the invisible half alone leaves the visible half behind —
    that is how "Dentastix Dog Treat" became "DentastixÂ Dog Treat" on screen.

    Both codecs are tried because the damage is not uniform: "Â\xa0" reverses
    under latin-1, but "â€“" only reverses under cp1252, whose 0x80-0x9F block
    holds the curly quotes and dashes that latin-1 leaves undefined. cp1252 goes
    first because it is the stricter reading.

    Abandoned silently when the text is already correct, which is the case for
    the ~2,220 rows that were never damaged.

    A few rows were damaged twice ("Olive OilÂÂ\xa0- Pure"), so the repair loops
    until it stops changing anything rather than running once.
    """
    text = str(value)
    for _ in range(MAX_MOJIBAKE_PASSES):
        for codec in ("cp1252", "latin-1"):
            try:
                repaired = text.encode(codec).decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
            if repaired != text:
                text = repaired
                break
        else:
            break
    return " ".join(text.translate(_JUNK).split())


def main():
    if not os.path.exists(SOURCE_XLSX):
        sys.exit("ERROR: missing {}".format(SOURCE_XLSX))

    with open(TILES_JSON, encoding="utf-8") as fh:
        tiles = json.load(fh)
    tile_by_id = {t["id"]: t for t in tiles}

    log("Reading {}".format(os.path.basename(SOURCE_XLSX)))
    df = pd.read_excel(SOURCE_XLSX)
    log("  rows in source: {}".format(len(df)))

    # -- 1. null product or brand ------------------------------------------
    before = len(df)
    df = df.dropna(subset=["product", "brand"])
    log("  after dropping null product/brand: {}  (-{})".format(len(df), before - len(df)))

    # Clean before deduping and before counting brands.
    #
    # Trailing spaces on some brand values ("MAGGI ", "Haldirams ") would split
    # one brand into two and halve its apparent frequency. Separately, 15 rows
    # carry mojibake from the source's encoding -- U+FFFD replacement characters
    # and non-breaking spaces, which render as "Dentastix DogÂ Treat" both in the
    # UI and burnt into the generated product image.
    df["product"] = df["product"].astype(str).map(clean_text)
    df["brand"] = df["brand"].astype(str).map(clean_text)

    # -- 2. duplicates on (product, brand) ---------------------------------
    before = len(df)
    df = df.drop_duplicates(subset=["product", "brand"], keep="first")
    log("  after dropping (product, brand) duplicates: {}  (-{})".format(len(df), before - len(df)))

    # -- 3. price band ------------------------------------------------------
    before = len(df)
    df = df[(df["sale_price"] >= MIN_PRICE) & (df["sale_price"] <= MAX_PRICE)]
    log("  after price band Rs.{}-{}: {}  (-{})".format(MIN_PRICE, MAX_PRICE, len(df), before - len(df)))

    # -- 4. sub_category -> tile -------------------------------------------
    unmapped = sorted(set(df["sub_category"]) - set(SUBCATEGORY_TO_TILE))
    if unmapped:
        log("\n  UNMAPPED sub-categories (dropped):")
        for sub in unmapped:
            log("    {:6d}  {}".format(int((df["sub_category"] == sub).sum()), sub))
    else:
        log("  all sub-categories mapped")

    df = df[df["sub_category"].isin(SUBCATEGORY_TO_TILE)].copy()
    df["tile"] = df["sub_category"].map(SUBCATEGORY_TO_TILE)
    log("  rows carrying a tile: {}".format(len(df)))

    # -- 5. sample per tile, preferring frequent brands ---------------------
    # The source has no popularity column; brand ubiquity is the closest
    # available proxy and it is what makes a sampled tile read like a real shelf.
    #
    # Frequency is counted WITHIN the tile's own pool, not across the whole dump.
    # Counted globally, the winners are whichever brands carry the widest SKU
    # range overall -- private labels and long-tail gourmet importers -- and
    # focused category leaders lose. Maggi ranks 12th inside instant food but
    # nowhere near the top globally, so a global count drops it from the
    # catalogue entirely and the spec's own Phase 2 search test cannot pass.
    # Counted per tile, instant food leads with MTR and Maggi, dairy leads with
    # Amul and Britannia. That is the intended shelf.
    #
    # The preference is applied brand-round-robin over a bounded brand set,
    # rather than as a flat sort. Both unbounded extremes fail:
    #
    #   flat top-N       -> whole tiles collapse to one brand. The most frequent
    #                       brands here are BigBasket private labels (Fresho,
    #                       bb Royal, BB Home) because private labels span the
    #                       widest SKU range, so a straight take yields 90 Fresho
    #                       vegetables. Browse & Replace then shows twelve
    #                       near-identical products.
    #   round-robin over -> every product is a different brand, so searching
    #   all brands          "maggi" returns exactly one result.
    #
    # So the brand set is capped at roughly target/TARGET_PRODUCTS_PER_BRAND,
    # taken in frequency order, and filled round-robin. Frequent brands still
    # lead and still win the most slots; each contributes a few SKUs, which is
    # what both search and Browse & Replace need. If those brands cannot fill
    # the target the set widens to the next tranche. bestsellerRank follows
    # selection order, so rank 1 is still the most frequent brand's first product.
    df["brand_freq"] = df.groupby("tile")["brand"].transform(lambda s: s.map(s.value_counts()))
    df = df.sort_values(
        ["tile", "brand_freq", "brand", "index"],
        ascending=[True, False, True, True],
        kind="mergesort",
    )

    selected = []
    shortfalls = []
    log("\n  per-tile selection:")
    for tile in tiles:
        tid = tile["id"]
        pool = df[df["tile"] == tid]
        target = tile["targetCount"]

        # Bucket by brand, preserving the brand-frequency order established above.
        buckets = []
        seen = {}
        for row in pool.itertuples(index=False):
            if row.brand not in seen:
                seen[row.brand] = len(buckets)
                buckets.append([])
            buckets[seen[row.brand]].append(row)

        tranche = max(1, -(-target // TARGET_PRODUCTS_PER_BRAND))  # ceil division
        picked = []
        active = 0
        depth = 0
        while len(picked) < target and active < len(buckets):
            active = min(len(buckets), active + tranche)
            depth = 0
            while len(picked) < target:
                progressed = False
                for bucket in buckets[:active]:
                    if depth < len(bucket):
                        picked.append(bucket[depth])
                        progressed = True
                        if len(picked) == target:
                            break
                if not progressed:
                    break
                depth += 1

        take = pd.DataFrame(picked, columns=pool.columns) if picked else pool.head(0)
        selected.append(take)
        flag = ""
        if len(take) < target:
            shortfalls.append((tid, len(take), target))
            flag = "  <-- SHORTFALL, wanted {}".format(target)
        n_brands = take["brand"].nunique() if len(take) else 0
        log("    {:<24} {:4d} products  {:3d} brands  (pool {}){}".format(
            tid, len(take), n_brands, len(pool), flag))

    out_df = pd.concat(selected, ignore_index=True)

    # -- 6/7/8. ids, ranks, flags -------------------------------------------
    #
    # bestsellerRank is assigned independently of selection order. Product ids
    # follow selection order, so keeping the two separate means a change to the
    # ranking scheme does NOT reshuffle ids -- which would otherwise invalidate
    # every generated image and every id in history.json.
    #
    # Within each tile, BESTSELLER_COUNT products are drawn at random and take
    # ranks 1..3. The rest follow in brand-frequency order from rank 4. The
    # fallback panel and the top of each shortlist therefore lead with one of
    # three plausible products rather than always the same one.
    rng = random.Random(BESTSELLER_SEED)
    rank_by_product = {}
    for tile_id in sorted(set(out_df["tile"])):
        positions = [
            i for i, row in enumerate(out_df.itertuples(index=False), start=1)
            if row.tile == tile_id
        ]
        chosen = rng.sample(positions, min(BESTSELLER_COUNT, len(positions)))
        rest = [p for p in positions if p not in set(chosen)]
        for rank, position in enumerate(chosen + rest, start=1):
            rank_by_product[position] = rank

    products = []
    for i, row in enumerate(out_df.itertuples(index=False), start=1):
        tile = tile_by_id[row.tile]

        name = clean_text(row.product)
        lowered = name.lower()
        consumable = tile["consumableDefault"]
        for kw in NON_CONSUMABLE_KEYWORDS.get(row.tile, []):
            if kw in lowered:
                consumable = False
                break
        else:
            for kw in CONSUMABLE_KEYWORDS.get(row.tile, []):
                if kw in lowered:
                    consumable = True
                    break

        products.append({
            "id": "p_{:05d}".format(i),
            "name": name,
            "brand": clean_text(row.brand),
            "tile": row.tile,
            "price": int(round(float(row.sale_price))),
            "mrp": int(round(float(row.market_price))),
            "imagePath": "/images/p_{:05d}.png".format(i),
            "isSearchable": tile["searchable"],
            "isConsumable": consumable,
            "bestsellerRank": rank_by_product[i],
        })

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(products, fh, ensure_ascii=False, indent=1)

    # -- summary ------------------------------------------------------------
    searchable = sum(1 for p in products if p["isSearchable"])
    durables = [p for p in products if not p["isConsumable"]]
    log("\n  wrote {} products to data/catalogue.json".format(len(products)))
    log("    searchable:        {}".format(searchable))
    log("    recommend-only:    {}".format(len(products) - searchable))
    log("    non-consumable:    {}".format(len(durables)))

    log("\n  durables inside consumable-default tiles (the exclusion rule needs these):")
    consumable_tiles = {t["id"] for t in tiles if t["consumableDefault"]}
    found_any = False
    for tid in sorted(consumable_tiles):
        n = sum(1 for p in durables if p["tile"] == tid)
        if n:
            found_any = True
            log("    {:<24} {}".format(tid, n))
    if not found_any:
        log("    NONE  <-- the durable-exclusion rule will not be observable")

    if shortfalls:
        log("\n  SHORTFALLS:")
        for tid, got, want in shortfalls:
            log("    {:<24} {} of {}".format(tid, got, want))
    else:
        log("\n  no shortfalls")


if __name__ == "__main__":
    main()
