"""
author_history.py — emits data/history.json for the seeded Dabbler persona.

This is the authoring tool for a hand-designed file, not a data pipeline. Every
structural choice below is a decision, not a sample: which tiles are active,
which lapsed and when, which durable the persona owns. The script exists so that
~200 line items reference real catalogue ids and so the file can be regenerated
if catalogue ids ever shift. Output is deterministic.

Lives in the phase folder rather than scripts/ because the build spec's scripts/
directory is specified to contain exactly two files.

Design, per build spec section 3.3:
  - accountAgeDays 247, clearing the 180-day tenure gate
  - 6 active tiles, each with a recurring run reaching within 7 days of today
  - 4 dormant tiles, each a run that stops between 35 and 120 days ago
      * pet-store holds a DURABLE the persona owns (padded harness) alongside a
        CONSUMABLE they bought repeatedly (dog food). The recommender must drop
        the harness from dormant candidates and keep the dog food.
      * cleaners-repellents is the lapsed staple: compostable garbage bags bought
        five times, then nothing for 38 days.
  - every other tile has zero orders, forming the never-bought pool
  - no tile is bought once and then re-bought after a gap; that reads as an
    Adopter, and this persona is a Dabbler

Usage:  python phases/phase-0-data/author_history.py
"""

import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CATALOGUE_JSON = os.path.join(ROOT, "data", "catalogue.json")
OUT_JSON = os.path.join(ROOT, "data", "history.json")

SEED = 20260802
ACCOUNT_AGE_DAYS = 247

# 40 shopping days, densest near today and thinning into the past, which is how
# a real account looks once you stop remembering to order.
ORDER_DAYS = [
    1, 2, 4, 5, 7, 9, 11, 14, 16, 19, 22, 25, 28, 31, 34, 38, 42, 46, 49, 53,
    58, 63, 67, 72, 78, 84, 90, 96, 103, 110, 118, 127, 136, 145, 155, 166,
    178, 190, 201, 212,
]

# tile -> (every Nth order day, earliest daysAgo the tile still appears)
# lapsedAt None means the tile is still active.
ACTIVE_TILES = {
    "vegetables-fruits": 1,        # the weekly shop
    "dairy-bread-eggs": 1,
    "atta-rice-dal": 3,
    "chips-namkeen": 2,
    "instant-food": 3,
    "drinks-juices": 4,
}

# tile -> daysAgo of its most recent order. Everything older than this still
# happened; nothing newer did.
DORMANT_TILES = {
    "cleaners-repellents": 38,
    "pet-store": 49,
    "bakery-biscuits": 67,
    "tea-coffee-milk-drinks": 103,
}
DORMANT_PERIOD = 2      # every 2nd eligible order day
DORMANT_RUN_LENGTH = 5  # orders per dormant tile before it went quiet

# Products the persona actually reorders, by tile. A Dabbler rebuys a narrow
# repertoire rather than exploring, so these lists are deliberately short.
# Ids are asserted against the catalogue at run time.
REPERTOIRE = {
    "pet-store": {
        "consumables": ["p_02161", "p_02157", "p_02166"],   # dog food, treats, supplement
        "durables": ["p_02159"],                            # padded harness — owned, must be excluded
    },
    "cleaners-repellents": {
        "consumables": ["p_01937", "p_01940", "p_01943"],   # garbage bags — the lapsed staple
        "durables": [],
    },
}

MIN_ITEMS_PER_ORDER = 3
MAX_ITEMS_PER_ORDER = 7


def main():
    with open(CATALOGUE_JSON, encoding="utf-8") as fh:
        catalogue = json.load(fh)
    by_id = {p["id"]: p for p in catalogue}
    by_tile = {}
    for p in catalogue:
        by_tile.setdefault(p["tile"], []).append(p)
    for products in by_tile.values():
        products.sort(key=lambda p: p["bestsellerRank"])

    for tile, groups in REPERTOIRE.items():
        for kind, ids in groups.items():
            for pid in ids:
                assert pid in by_id, "{} not in catalogue".format(pid)
                assert by_id[pid]["tile"] == tile, "{} is not in {}".format(pid, tile)
                want_consumable = kind == "consumables"
                assert by_id[pid]["isConsumable"] == want_consumable, (
                    "{} isConsumable={} but listed under {}".format(
                        pid, by_id[pid]["isConsumable"], kind))

    rng = random.Random(SEED)

    def repertoire_for(tile):
        """A narrow, stable set of ids this persona rebuys from a tile."""
        if tile in REPERTOIRE:
            return REPERTOIRE[tile]["consumables"]
        pool = [p for p in by_tile[tile] if p["isConsumable"]][:14]
        return [p["id"] for p in rng.sample(pool, min(5, len(pool)))]

    tile_repertoire = {}
    for tile in list(ACTIVE_TILES) + list(DORMANT_TILES):
        tile_repertoire[tile] = repertoire_for(tile)

    # ---- build per-order line items -------------------------------------
    orders = []
    for idx, days_ago in enumerate(sorted(ORDER_DAYS)):
        items = {}

        for tile, period in ACTIVE_TILES.items():
            if idx % period == 0:
                for pid in rng.sample(
                    tile_repertoire[tile], min(2, len(tile_repertoire[tile]))
                ):
                    items[pid] = items.get(pid, 0) + rng.choice([1, 1, 1, 2])

        for tile, lapsed_at in DORMANT_TILES.items():
            if days_ago < lapsed_at:
                continue
            # eligible is ascending, so index 0 IS the lapse day. Taking the first
            # few indices walks backwards in time from the lapse point, which is
            # what "bought repeatedly, then stopped" looks like.
            eligible = [d for d in sorted(ORDER_DAYS) if d >= lapsed_at]
            position = eligible.index(days_ago)
            if position % DORMANT_PERIOD != 0:
                continue
            if position // DORMANT_PERIOD >= DORMANT_RUN_LENGTH:
                continue
            # The first repertoire entry is the staple and appears in every order
            # of the run; that repetition is what makes it read as lapsed rather
            # than as a one-off trial.
            repertoire = tile_repertoire[tile]
            items[repertoire[0]] = items.get(repertoire[0], 0) + rng.choice([1, 1, 2])
            for pid in rng.sample(repertoire[1:], min(1, len(repertoire) - 1)):
                items[pid] = items.get(pid, 0) + 1

        if not items:
            continue

        # Trim or pad toward a believable basket size.
        if len(items) > MAX_ITEMS_PER_ORDER:
            keep = rng.sample(list(items), MAX_ITEMS_PER_ORDER)
            items = {k: items[k] for k in keep}
        while len(items) < MIN_ITEMS_PER_ORDER:
            tile = rng.choice(list(ACTIVE_TILES))
            pid = rng.choice(tile_repertoire[tile])
            if pid in items:
                break
            items[pid] = 1

        orders.append({
            "orderId": "o_{:03d}".format(len(orders) + 1),
            "daysAgo": days_ago,
            "items": [
                {"productId": pid, "quantity": qty}
                for pid, qty in sorted(items.items())
            ],
        })

    # The owned durable: bought once, deep inside the pet-store run, exactly as
    # someone buys a harness once and never again. Attached to the oldest
    # pet-store order so it cannot be mistaken for a recent purchase.
    pet_orders = [
        o for o in orders
        if any(by_id[i["productId"]]["tile"] == "pet-store" for i in o["items"])
    ]
    assert pet_orders, "no pet-store orders were generated"
    oldest_pet = max(pet_orders, key=lambda o: o["daysAgo"])
    oldest_pet["items"].append({"productId": REPERTOIRE["pet-store"]["durables"][0],
                                "quantity": 1})
    oldest_pet["items"].sort(key=lambda i: i["productId"])

    history = {
        "user": {
            "id": "u_dabbler_01",
            "accountAgeDays": ACCOUNT_AGE_DAYS,
            "segment": "dabbler",
        },
        "orders": orders,
    }

    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(history, fh, ensure_ascii=False, indent=1)

    line_items = sum(len(o["items"]) for o in orders)
    print("wrote data/history.json")
    print("  orders:     {}".format(len(orders)))
    print("  line items: {}".format(line_items))
    print("  span:       {}..{} daysAgo".format(
        min(o["daysAgo"] for o in orders), max(o["daysAgo"] for o in orders)))


if __name__ == "__main__":
    main()
