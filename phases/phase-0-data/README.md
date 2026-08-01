# Phase 0 — Data preparation

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 0 (0.1–0.4), §3.1–3.4

Produces the four committed seed files every later phase reads. Nothing in this
phase ships to the browser as code — the two scripts in `scripts/` are developer
tools that run locally and are never invoked by the app.

## What this phase produced

| File | Rows | How |
|---|---|---|
| `data/tiles.json` | 27 tiles | Hand-authored from build spec §3.1 |
| `data/catalogue.json` | 2,236 products | `scripts/reduce_catalogue.py` |
| `public/images/*.png` | 2,236 tiles | `scripts/generate_images.py` |
| `data/history.json` | 40 orders / 244 line items | `phases/phase-0-data/author_history.py` |
| `data/search-aliases.json` | 36 aliases | Hand-authored, every target verified |

Catalogue split: **1,558 searchable**, **678 recommend-only**, 300 non-consumable.
Spec targeted ~2,150 / ~1,500 / ~650.

## How to reproduce

```bash
pip install pandas openpyxl Pillow
python scripts/reduce_catalogue.py
python scripts/generate_images.py
python phases/phase-0-data/author_history.py
node phases/phase-0-data/verify_history.js
```

`generate_images.py` skips files that already exist. Product ids are positional,
so **any change to the catalogue shifts ids and invalidates every image** — delete
`public/images/` and regenerate, or pass `--force`.

## Files in this folder

- `author_history.py` — emits `data/history.json`. Lives here rather than in
  `scripts/` because the build spec specifies `scripts/` as containing exactly
  two files. `history.json` is a designed artefact, not a sampled one; the script
  is the authoring tool for a hand-made design, and exists so ~200 line items
  reference real catalogue ids and can be regenerated when ids shift.
- `verify_history.js` — the spec's Phase 0.3 test, as an assertion suite.

## Test results

### 0.1 — `reduce_catalogue.py`

> Spec: *console prints per-tile final counts and any shortfalls; ~2,150 entries;
> no tile below 40 products except `ice-creams-more` and `beauty-cosmetics`.*

**PASS.** 2,236 products, no shortfalls, smallest tiles are `ice-creams-more` (48)
and `beauty-cosmetics` (48) — both source-limited exactly as the spec predicted.
All 90 source sub-categories map to a tile; none dropped.

### 0.2 — `generate_images.py`

> Spec: *one PNG per catalogue entry; open five at random — text legible, colours
> differ by tile.*

**PASS.** 2,236 PNGs. Inspected five spanning `baby-care`, `sauces-spreads`,
`dry-fruits-cereals`, `beauty-cosmetics`, `atta-rice-dal`, including the longest
name in the catalogue (122 chars) — wraps to six lines and still fits with the
brand line beneath.

### 0.3 — `history.json`

> Spec: *print every tile with its classification and `mostRecentDaysAgo`; confirm
> 5–6 active, 3–4 dormant, the rest never-bought, and at least one dormant tile
> containing a durable the persona owns.*

**PASS — 12/12 checks.** `node phases/phase-0-data/verify_history.js`

| Class | Count | Tiles |
|---|---|---|
| Active | 6 | `vegetables-fruits` (1d), `dairy-bread-eggs` (2d), `atta-rice-dal` (1d), `chips-namkeen` (1d), `instant-food` (1d), `drinks-juices` (1d) |
| Dormant | 4 | `cleaners-repellents` (38d), `pet-store` (49d), `bakery-biscuits` (67d), `tea-coffee-milk-drinks` (103d) |
| Never-bought | 17 | everything else, including the whole Beauty & Personal Care section, `electronics`, `kitchenware-appliances` |

The two observable rules the panel depends on:

- **Durable exclusion** — the persona owns `p_02159` *Padded Harness*, `bestsellerRank` 3
  in `pet-store` and non-consumable. It must never appear as a dormant candidate.
  Rank 3 is deliberate: high enough that its absence from a 12-item shortlist is visible.
- **Lapsed staple** — `p_01937` compostable garbage bags bought in 4 separate orders,
  then nothing for 38 days. Consumable, so it stays eligible. `p_02161` dog food, 3 orders,
  is the same case inside `pet-store`.

Dormant tiles sorted ascending by `mostRecentDaysAgo` give `cleaners-repellents`,
`pet-store`, `bakery-biscuits` as the three offered to the model — `pet-store` is in
the offered set, so the durable rule is reachable in a normal run.

### 0.4 — `search-aliases.json`

**PASS.** 36 entries (spec targeted 20–30; kept the extras since each one resolves).
Every alias target was checked against the searchable catalogue — zero dead targets.

## Open items handed to later phases

1. **`colgat` cannot pass the Phase 2 search test.** See PROJECT_MEMORY decision D5.
2. **Never-bought tile ranking is degenerate.** See decision D7 — a Phase 4 problem.
