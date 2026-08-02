# Phase 5 — Panel UI

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 5 (5.1–5.4), §4 Steps 1–3 and 12–13
**Edge cases closed:** C7, F1, F2, F3, F4, F7, G1 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

The panel becomes visible. Visual direction follows the owner's prototype
screenshots; four elements of that prototype were overruled by the project's own
documents, and those are recorded as **D26–D29** in
[`../../PROJECT_MEMORY.md`](../../PROJECT_MEMORY.md).

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/panelCache.ts` | `sc_panel_cache` read/write, capped, stale-id aware. |
| `src/components/SmartCartPanel.tsx` | Mount-time fetch, signature cache, skeleton, dismiss, add/restore. |
| `src/components/RecommendationRow.tsx` | One suggestion row. Exports the shared row-height class. |
| `src/components/QuantityStepper.tsx` | Gained a `tone` (green/violet) and `disabled` prop. |
| `src/app/cart/page.tsx` | Panel wired between cart lines and Bill details; delivery + address cards. |
| `src/components/BillDetails.tsx` | Items total / Delivery fee FREE / Grand total. |

## How to run

```bash
node phases/phase-5-panel-ui/verify_panel_cache.ts
```

## Test results

### Spec test

> *Cart page shows four rows. ADD removes a row and adds to cart without the
> Bill details block jumping. Remove from cart — the row returns. Navigate away
> and back with an unchanged cart — panel renders from cache with no network
> request.*

**PASS**, all four clauses verified live at a 375×812 viewport.

| Clause | Evidence |
|---|---|
| Four rows | `cleaners-repellents`, `pet-store`, `baby-care`, `beauty-cosmetics` — slots A, A, B, B |
| ADD removes the row, no jump | Panel 4 → 3 rows; cart 3 → 4 lines; total ₹274 → ₹714 (+₹440, the row's price) |
| Row returns | Removing it from the cart restored it **to position 2**, reason line intact |
| Cache, no network | 0 `/api/recommend` requests on return; panel resolved immediately with identical rows |

**Layout stability was measured, not eyeballed.** With `/api/recommend` held open
so the skeleton was observable, the panel measured **357px** and Bill details sat
at **y=815** — identical in both the skeleton and resolved states. See the defect
below for why the first attempt did not.

### Panel cache suite — `verify_panel_cache.ts`

**PASS — 11/11.** Round trip, eviction at `PANEL_CACHE_MAX_ENTRIES`, re-write
moving a signature to most-recent rather than leaving it first to evict, and
refusal to serve any cached panel whose row or shortlist references a product the
catalogue no longer has.

### Events

One mount produces exactly one `recommend_call` and one `panel_impression` — no
StrictMode doubling (EDGE_CASES G1). Payloads verified complete:

```
panel_impression  products[4], slots ["A","A","B","B"], tiles[4], cartSignature, source "fallback"
recommend_call    latencyMs 72, outcome "fallback_nokey"
panel_add         productId, slot "A", tile "pet-store", position 2
cart_add          source "panel"
panel_dismiss     cartSignature   (exactly one per dismiss; re-expanding logs nothing)
```

## Two defects found by testing

**A 2px layout shift, invisible by eye.** The skeleton measured 357px and the
resolved panel 355px. `.panel-row` used `max-height: 76px` to drive the exit
animation, but Tailwind sets `box-sizing: border-box`, so the 1px row border ate
into that cap and clipped each resolved row. Replaced with a
`grid-template-rows: 1fr → 0fr` transition, which collapses to exactly zero and
imposes no cap at rest — so no magic number has to stay in sync with the row
height. Re-measured: 357px in both states, zero shift.

**`panel_dismiss` logged twice per click.** The event was fired inside the
`setDismissed` updater function. React deliberately double-invokes state updaters
under StrictMode to surface impure ones — which is exactly what this was. Moved
the log outside the updater. This is the same class of metric corruption that
G1 guards against, arriving by a different route.

A third, found before either: the panel hung on its skeleton forever in dev,
because the StrictMode fetch guard and an in-flight `cancelled` flag are mutually
exclusive. See D30.

## Not done here, on purpose

- **No Browse & Replace.** Spec 5.2 lists the row as "image, name, price, reason
  line, ADD"; the sheet is 7.1. The prototype shows the link on every row and it
  will land there — the row height constant is in one place, so both the row and
  the skeleton pick it up together.
- **No bulk-add tick.** Cut per the owner's decision and both documents.
- **No struck-through `mrp` or "Special Price" tag.** Deferred per spec §8.
- **No model.** `source` is `"fallback"` and `outcome` is `"fallback_nokey"`
  until Phase 6.
