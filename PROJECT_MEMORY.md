# Smart Cart — Project Memory

Single point of resource for handoff. Every phase appends its decisions, outcomes
and gotchas here. If this project changes hands, this file plus `phases/*/README.md`
should be enough to continue without the original build conversation.

**Governing documents:** [`smart-cart-build-spec.md`](smart-cart-build-spec.md) is
the literal build instruction — file paths, constant names and phase order come
from it. [`smart-cart-mvp-idea-doc.md`](smart-cart-mvp-idea-doc.md) is the product
rationale behind the rules.

**Companion register:** [`EDGE_CASES.md`](EDGE_CASES.md) lists all 47 identified
failure modes with severity, mitigation and owning phase. Each phase README states
which entries it closed.

**Conventions**
- App lives at the repo root (not nested in `smart-cart/`), so `phases/`, `data/`,
  `scripts/`, `src/` and `public/` are siblings.
- Decisions are numbered `D<n>` and referenced from phase READMEs.
- A decision is logged when it departs from the spec, resolves an ambiguity in it,
  or would otherwise be invisible to whoever reads the code next.

---

## Environment as built

| | |
|---|---|
| Node | v24.15.0, npm 11.16.0 |
| Python | **3.9.9** — spec asks for 3.10+ |
| Python packages | pandas 2.3.3, Pillow 10.2.0, openpyxl 3.1.5 |
| Git | initialised at repo root, no remote yet |
| Groq key | not yet obtained — first needed in Phase 6 |

---

## Phase 0 — Data preparation

**Completed.** All four sub-phase tests pass. Detail and reproduction steps in
[`phases/phase-0-data/README.md`](phases/phase-0-data/README.md).

Outputs: `data/tiles.json` (27), `data/catalogue.json` (2,236), `data/history.json`
(40 orders / 244 line items), `data/search-aliases.json` (36), `public/images/`
(2,236 PNGs).

### Decisions

**D1 — Source data is BigBasket-shaped, and the mapping is explicit.**
`Blinkit_Products.xlsx` is a BigBasket dump: categories read *Beauty & Hygiene*,
*Kitchen, Garden & Pets*. Its 27,555 rows and 8,626 null ratings match the spec's
stated figures exactly, so this is the file the spec was written against. All 90
distinct `sub_category` values are mapped to a tile in `SUBCATEGORY_TO_TILE` at the
top of `scripts/reduce_catalogue.py`; **none are dropped**. A handful of names
appear under more than one category (`Atta, Flours & Sooji` under four), but every
collision resolves to the same tile, so `sub_category` alone is a sufficient key.
There is deliberately no fallback bucket — a silently mis-binned sub-category would
corrupt dormancy, never-bought and diversity logic, which all operate on tiles.

**D2 — Brand sampling took three attempts; the first two produced unusable catalogues.**
The spec says to sample each tile "preferring rows whose brand appears most
frequently in the source". Read literally that is a flat sort, and it fails:

| Attempt | Result |
|---|---|
| Flat top-N by global brand frequency | Whole tiles collapse to one brand — 90 Fresho vegetables, 120 bb Royal staples, 70 INATUR skincare. The most frequent brands in this dump are BigBasket private labels, precisely because private labels span the widest SKU range. Browse & Replace would show twelve near-identical products. |
| Round-robin across all brands | The opposite failure — every product a different brand, so searching `maggi` returns exactly one result. |
| **Per-tile frequency + bounded brand set, round-robin** | Adopted. ~`target/3` brands per tile, taken in frequency order, filled round-robin. |

Two things had to change together. Frequency is now counted **within the tile's own
pool**, not across the whole dump: counted globally the winners are whichever brands
carry the widest range overall, so Maggi — 12th inside instant food, nowhere near the
top globally — was dropped from the catalogue entirely and the spec's own Phase 2
search test could not have passed. And the brand set is **capped** at roughly
`target / TARGET_PRODUCTS_PER_BRAND` (3), so each brand contributes a few SKUs.
Result: Maggi, Amul, Britannia, Tata, Tropicana, Surf, Dettol, Nescafé and
Haldiram's are all present and searchable, at 16–40 brands per tile.

**D3 — Strip whitespace before deduping and counting.**
The source has trailing spaces on some brand values (`"MAGGI "`, `"Haldirams "`).
Left alone, one brand counts as two and its apparent frequency halves — which,
combined with D2, is enough to drop it from a tile. Trimming happens immediately
after the null drop, before both the `(product, brand)` dedup and the brand counts.

**D4 — `Drinks & Beverages` files under `tea-coffee-milk-drinks`, not `drinks-juices`.**
Of its 736 rows, 335 are gourmet tea, 157 coffee and 80 health drinks — 78%. Sent to
`drinks-juices` it drowned the juice tile in loose-leaf Darjeeling; the first build
had `drinks-juices` leading with TGL Co., Te-A-Me and Karma Kettle. After the remap
`drinks-juices` leads with Real, Tropicana, Paper Boat and B Natural, and
`tea-coffee-milk-drinks` leads with TGL Co. and VAHDAM. Both tiles now read as
their label.

**D5 — `Oral Care` files under `health-pharma`, which makes the spec's `colgat` test unsatisfiable. NEEDS A CALL BEFORE PHASE 2.**
Colgate exists only in `Oral Care` (271 source rows). Every tile in the Beauty &
Personal Care section is `searchable: false` per the spec's own tile table, and the
spec provides no oral-care tile. So `Oral Care` cannot land anywhere searchable
without altering the tile table — yet the Phase 2 test says *"search `maggi`,
`colgat`, `cold drink`, `pedigree`. First three return sensible results."*

Resolved in favour of the tile table, because the table is load-bearing for the
feature and the specific test word is not: the test's purpose is typo tolerance,
which any brand demonstrates. `maggi`, `cold drink` and `pedigree` all behave
exactly as specified. **Phase 2 will substitute a searchable brand for the typo
test** — `britania`/`amull`/`tropicanna` are the candidates.

The alternative — flipping `health-pharma` to `searchable: true` — is a one-line
change if preferred, but it shrinks the never-bought pool and makes oral care
reachable by search, which is the thing the demo is built to prevent.

**D6 — `history.json` is authored by a script that lives in the phase folder.**
The spec calls this file hand-authored, and every structural choice in it is a
design decision, not a sample. But ~200 line items must reference real catalogue
ids, and ids shift whenever the catalogue is rebuilt — so the design is encoded in
`phases/phase-0-data/author_history.py` and regenerated deterministically
(`SEED = 20260802`). It is **not** in `scripts/` because the spec specifies that
directory as containing exactly two files.

**D7 — Never-bought tile ranking is degenerate. A Phase 4 problem, flagged now.**
Spec Step 6 selects never-bought tiles by "`bestsellerRank` of their top product
ascending". Every tile's top product has rank 1, so all 17 never-bought tiles tie
and the selection collapses to whatever order the array happens to be in — which
would offer `oil-ghee-masala`, `dry-fruits-cereals`, `chicken-meat-fish` and
`kitchenware-appliances`. Three of those are ordinary grocery. The feature exists to
surface Beauty & Personal Care, Electronics and Pet Store, and this ordering
surfaces none of them. **Phase 4 must choose a meaningful tie-break** and log it.

### Gotchas

- **Product ids are positional.** `p_00001`..`p_02236` are assigned in tile order
  after sampling, so any catalogue change reshuffles them and silently invalidates
  `public/images/` *and* `data/history.json`. Rebuild order is always:
  `reduce_catalogue.py` → delete `public/images/` → `generate_images.py` →
  `author_history.py` → `verify_history.js`. This bit twice during Phase 0.
- **Dormant runs are indexed from the lapse day.** In `author_history.py` the
  eligible-days list is sorted ascending, so index 0 *is* the most recent order.
  The first cut of the scheduling condition read it as oldest-first and produced
  dormancy at 155–178 days, outside the spec's 35–120 window. The verifier caught it.
- **`cola` matches "cho-cola-te".** There are no soft drinks in this dataset at all,
  so the spec's example alias `cold drink → soft drinks` returns nothing. Retargeted
  to `juice` (27 hits). Every one of the 36 aliases was checked against the
  searchable catalogue; there are no dead targets.
- **Python 3.9, not 3.10+.** pandas and Pillow are fine on it, so no upgrade was
  forced, but the scripts avoid `match` statements and `X | Y` runtime unions.
- **`mrp` is populated but must not be rendered in v1** (spec §8) — it is reserved
  for struck-through pricing, which is explicitly deferred.

---
