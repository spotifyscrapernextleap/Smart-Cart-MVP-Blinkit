# Phase 2 — Catalogue and search

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 2 (2.1–2.5), §3.4
**Edge cases closed:** A2, A3, A4, B1a, B2, B3, B4, B5, B6, B7, H1 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

Home screen, client-side search, and the results page. This is the surface an
evaluator uses to probe the catalogue, so most of the work here was relevance
quality rather than wiring.

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/catalogue.ts` | Static-import loaders, indexed by id and tile. Tile buckets pre-sorted by bestseller rank. |
| `src/lib/search.ts` | Alias rewriting, Fuse.js index, relevance cutoff. |
| `src/lib/events.ts` | `logEvent`, capped at `EVENT_LOG_CAP`, trimmed on write. |
| `src/components/AppHeader.tsx` | Delivery promise and location line. |
| `src/components/SearchBar.tsx` | The only interactive element on Home. |
| `src/components/CategoryGrid.tsx` | 27 tiles, 5 sections, four per row, inert. |
| `src/components/ProductCard.tsx` | Search result card. ADD is wired in Phase 3. |
| `src/components/ProductImage.tsx` | Plain `<img>` with a fallback initial. |
| `src/app/page.tsx` | HOME — replaces the Phase 1 diagnostic shell. |
| `src/app/search/page.tsx` | Results, empty states, `search` event. |

`events.ts` arrives here rather than in Phase 8 because spec 2.5 requires logging
`search`, and §3.6 is explicit that retrofitting event calls is the expensive
part. Phase 8 adds the remaining call sites and verifies the full set.

## How to run

```bash
npm run dev
```

```bash
node phases/phase-2-catalogue-search/verify_search.ts
```

## Test results

### Spec test

> *Search `maggi`, `colgat`, `cold drink`, `pedigree`. First three return
> sensible results. `pedigree` returns nothing — Pet Store is not searchable.*

**PASS, with the `pedigree` clause superseded by decision D12.** Every product is
now searchable, so `pedigree` returns its three products rather than nothing.
Verified live in the browser at 375×812:

| Query | Result |
|---|---|
| `maggi` | 3 — exactly the three MAGGI products |
| `colgat` (typo) | 3 Colgate products; typo tolerance working |
| `cold drink` | 31 juices — the alias rewrite firing end to end |
| `pedigree` | 3 Pedigree products |
| `iphone` | **"Not available here"** empty state |

### Verification suite — `verify_search.ts`

**PASS — 37/37.** Catalogue loaders, alias rewriting, query guards, and two
opposed coverage lists: 66 queries that must return something, and 12 that must
return nothing.

## What went wrong, and what fixed it

Three defects surfaced only because the suite tested real queries rather than the
happy path.

**1. Multi-word alias values returned nothing.** `dal` → `"dal pulses lentil"`
gave zero results, as did `maida`, `namkeen` and `matchbox`. Fuse matches the
query as a **single fuzzy pattern**, so expanding a word into a phrase produces a
17-character string resembling no product name. Single-word alias values return
25–40 results; multi-word ones returned 0–4. Every alias value is now one word,
and the suite asserts it. Several aliases were deleted outright because the
native term already worked better — `atta` unaliased leads with "Khapli Atta"
rather than generic flour.

**2. Relevance fell off a cliff but all 40 rows still rendered.** `maggi` matched
146 products: three MAGGI, then "Liner Magique Eyeliner". Scores separate cleanly
— answerable queries score 0.00–0.21, unanswerable ones 0.52–0.79 — so
`SEARCH_MAX_SCORE = 0.35` sits in the empty gap between them.

A first attempt used a cutoff *relative* to the best hit. It fixed `maggi` and
did nothing for `iphone`, which returned 40 rows of honey and hair conditioner:
when every match is bad the best one is bad too, so the whole tail sits inside
the band. The cutoff has to be absolute. Both cases are now in the suite.

**3. Mojibake in 15 product names.** `DentastixÂ Dog Treat` — the source was
written UTF-8 and read back as a single-byte codec, so a non-breaking space
arrives as `Â\xa0`. Stripping the invisible half leaves the visible half behind.
Fixed in `reduce_catalogue.py` by reversing the round-trip, trying cp1252 before
latin-1 (`â€“` only reverses under cp1252) and looping up to three times because
a few rows were damaged twice. The catalogue now contains no non-ASCII beyond
four legitimate en dashes.

## Decisions

Recorded as **D15–D18** in [`../../PROJECT_MEMORY.md`](../../PROJECT_MEMORY.md).

## Not done here, on purpose

- **ADD does nothing yet.** Rendered so the card layout is final; wired in Phase 3.
- No cart, no `cart_add` event, no `ViewCartBar`.
- Category tiles are inert. No tile is clickable in v1 and browse navigation is deferred.
- `CategoryGrid` currently dims nothing — every tile is searchable after D12. The
  branch is retained so flipping a tile back in `tiles.json` restores it.
