# Phase 4 — Recommendation engine, deterministic path

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 4 (4.1–4.4), §4 Steps 4–7 and 10–11
**Edge cases closed:** D1, D1a, D2, D3, D4, D5, D6, D8, D9 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

**No API key. No network.** This phase produces a fully working four-row panel.
The spec is explicit that the fallback is the panel's default state and the model
is an enhancement layered on top, not an error handler bolted on at the end.

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/recommend/dormancy.ts` | Tile classification from history; `ownedProductIds`; per-section order counts. Memoised. |
| `src/lib/recommend/shortlist.ts` | Tile selection and all four candidate exclusions, including the price ceiling. |
| `src/lib/recommend/templates.ts` | Template reason lines. |
| `src/lib/recommend/fallback.ts` | Panel assembly, slot allocation, backfill. |
| `src/app/api/recommend/route.ts` | POST handler — the only server-side file. |

## How to run

```bash
node phases/phase-4-recommend/verify_recommend.ts
```

```bash
curl -s -X POST http://localhost:3000/api/recommend -H "Content-Type: application/json" -d '{"cart":[{"productId":"p_01163","quantity":1},{"productId":"p_01398","quantity":1}]}'
```

## Test results

### Spec test

> *Response has exactly 4 rows, slots `["A","A","B","B"]`, 4 distinct tiles, both
> B products priced at or below `max(100, subtotal × 0.5)`, and no dormant product
> that the persona owns and that is a durable. Vary the cart subtotal and confirm
> the B products change accordingly.*

**PASS**, verified by `curl` against the running route.

| Cart | Subtotal | Ceiling | Slot-B products |
|---|---|---|---|
| 1 × Maggi noodles | ₹85 | ₹100 | ₹99, ₹70 |
| 3 × cat food | ₹5,961 | ₹2,981 | ₹598, ₹157 |

Rows come back `A, A, B, B` across four distinct tiles in both cases, and the
slot-B products change with the ceiling exactly as required. The owned durable
`p_02159` (Padded Harness, rank 6 in `pet-store`) is absent from the returned
`pet-store` shortlist while the owned *consumable* `p_02161` (dog food) remains —
which is the whole point of the `isConsumable` distinction.

### Verification suite — `verify_recommend.ts`

**PASS — 76/76.** Covers classification, the price-ceiling formula, shortlist
construction, and every spec §1 non-negotiable asserted against three different
carts (ordinary, empty, expensive), plus determinism and the D1a behaviour.

### Malformed request bodies

All return HTTP 200 with a valid four-row panel: empty cart, missing `cart` key,
unparseable JSON, `"cart": null`, junk entries (non-string ids, missing fields,
`null` elements, ids absent from the catalogue), and negative quantities. The
panel is supposed to render regardless, so a bad body degrades to an empty cart
rather than a 500.

## Decisions

Recorded as **D23–D25** in [`../../PROJECT_MEMORY.md`](../../PROJECT_MEMORY.md).
The headline is **D23**, which finally resolves the long-open D6 tie-break.

## Known rough edge, for Phase 6 to improve

At a low ceiling the deterministic slot-B pick is simply the top-ranked product
under ₹100, which can be a poor fit — a ₹100 cart currently surfaces
*"Peristaltic Nipple — 'S' Hole"* from `baby-care`. Nothing is wrong: the tile is
genuinely never-bought, the price is under the ceiling, and the reason line
claims nothing false. But it is not a *plausible* suggestion for this persona.

This is precisely the job the model layer does — spec §4 Step 8 asks it to
"choose the product from each shortlist that most plausibly belongs alongside"
the cart. The shortlist is already correct; Phase 6 improves the choice *within*
it. Worth watching in the Phase 6 test rather than treating as a Phase 4 bug.

## Not done here, on purpose

- No model call, no `openai` package, no `GROQ_API_KEY`. Phase 6.
- No panel UI. Phase 5 renders these rows.
- `source` is hardcoded `"fallback"`; Phase 6 sets it per outcome.
- `validate.ts` and `prompt.ts` do not exist yet — but `fallback.ts`'s
  `buildRows()` already takes an optional `chooseProduct` callback so the model
  path can supply its own pick and reason per shortlist without restructuring.
