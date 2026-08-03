# Phase 7 — Browse & Replace

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 7 (7.1–7.2), §4 Step 13
**Edge cases closed:** F5, F6 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

> **Superseded numbers.** Two owner-requested UI changes after Phase 8 moved the
> figures recorded here: the row is now `h-[106px]` (not 92px) and the panel
> measures **477.33px** (not 421.33px), because the reason line wraps to two
> lines; and the panel is now full-bleed inside the cart card with no dashed
> border. F1 still measures 0px shift. See **D37/D38** in
> [`../../PROJECT_MEMORY.md`](../../PROJECT_MEMORY.md). Everything else below
> stands.

The panel becomes negotiable. Each row gains a control that opens the rest of
that row's shortlist, and picking one swaps it in place — same slot, same
position, no network call, because the response has carried the full ranked
lists since Phase 4.

The design question this phase had to answer first was **where the control
goes**: the owner's prototype put "Browse and Replace" under the product name,
but the prototype had no reason line, and the idea doc calls the reason line P0.
Both wanted the same slot. Resolved as **D34**.

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/recommend/replace.ts` | What the sheet may offer, and what a swap preserves. |
| `src/components/BrowseReplaceSheet.tsx` | The bottom sheet: modal, focus-managed, scroll-locked. |
| `src/components/RecommendationRow.tsx` | Third line in the middle column; row height 76px → 92px. |
| `src/components/SmartCartPanel.tsx` | Replacement overlay, sheet wiring, the last two events. |
| `src/app/globals.css` | Sheet rise and backdrop fade. |
| `src/lib/config.ts` | `SHEET_ENTER_MS` added. |

## How to run

```bash
node phases/phase-7-browse-replace/verify_replace.ts
```

No key, no network, no browser.

## Test results

### Spec test

> *Open the sheet on a slot-A row — it appears instantly with no network
> request. Replace. The row updates, remains slot A, and stays in the same
> position. ADD on the replacement adds the replacement.*

**PASS**, all four clauses verified live in the browser.

| Clause | Evidence |
|---|---|
| Opens with no network request | `/api/recommend` call count stayed at **1** (the mount fetch) across open, replace and close |
| Row updates | Row 1 went from "Dish Wash" to "Garbage Bags — Compostable", chosen from the sheet |
| Remains slot A, same position | `panel_add` logged `slot: "A"`, `position: 1` for the replacement |
| ADD adds the replacement | Cart gained `p_01937` (the replacement); `p_01998` (the original) never entered it |

### Other behaviour verified live

| | Evidence |
|---|---|
| Sheet geometry | Rests flush at viewport bottom, 480px wide matching the shell, centred, within the 70vh cap |
| Modal behaviour | Focus moves to close, `body` scroll locked on open and restored on close, Escape closes |
| **F1 not regressed** | Skeleton **421.33px**, resolved panel **421.33px** — **0px shift**, with all rows at 92px in both states |
| F3 survives a replacement | Removing the replacement from the cart restored the row at position 1 **as the replacement**, not the original |
| F5 | With the whole shortlist in the cart, that row renders an inert "No alternatives left" and no button — other rows keep theirs, height unchanged |
| Console | No errors |

### Verification suite — 71/71

| Group | Checks |
|---|---|
| What the sheet offers (spec 7.1, F6) | 5 |
| A shortlist that has outlived its catalogue (C2) | 1 |
| Missing or empty shortlists | 4 |
| The control is disabled rather than opening empty (F5) | 4 |
| The swap preserves what identifies the row (spec 7.2) | 16 |
| A reason line survives only if it is about the tile | 3 |
| **The sheet is not a way around the panel's rules (spec §1)** | 32 |
| The owned Padded Harness stays out of the sheet | 2 |
| Swapping back, and repeated swaps | 3 |
| Determinism | 1 |

The 32-check group is the load-bearing one. A second surface onto the same
candidates is exactly where a rule leaks, so every alternative on every row of
four different carts is checked against D1, D1a, D3, D4 and D5 — and every row
is then replaced at once, which is the worst case for tile diversity.

## Edge cases closed

| # | How |
|---|---|
| **F5** | `canBrowse` returns false when the shortlist minus the displayed product minus the cart is empty; the row renders an inert label instead of a control. Reachable for real — D7 records `bath-body` having only four products under a ₹100 ceiling. |
| **F6** | `alternativesFor` excludes cart contents. This is not redundant with the shortlist's own exclusion: the panel is computed once at mount, so by the time the sheet opens the cart can hold products the shortlist was built without. |

## Gotchas

- **CSS animations are frozen in the browser pane, exactly like
  `requestAnimationFrame`.** `document.timeline.currentTime` reads 0, so the
  sheet sat at its first keyframe — `translateY(100%)`, entirely below the fold
  — and measuring it suggested the sheet rendered off-screen. It is a pane
  artifact, not a bug. To measure resting geometry:
  `el.getAnimations().forEach(a => a.finish())` first.
- **`javascript_tool` shares one scope across calls**, so a second call
  declaring `const rows` fails with "Identifier 'rows' has already been
  declared". Wrap each snippet in an IIFE.
- **Rows are keyed by `position`, not `productId`.** A replacement is the same
  row holding a different product; keying by product unmounts and remounts it,
  which throws away its place in the list and re-triggers its entry animation.
- **The reason line does not automatically survive a swap** — see D34. Slot A
  keeps its line because that line is structurally a claim about the tile; slot
  B does not, because nothing guarantees its line is not about the product.
