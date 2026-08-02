# Phase 8 — Events

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 8 (8.1–8.2), §3.6
**Edge cases closed:** G2, G3, G4 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

This phase built almost nothing. `events.ts` shipped in Phase 2 (D17), because
spec §3.6 is explicit that retrofitting event calls into finished components is
the expensive part, and every phase since wired its own call sites as it went.
What Phase 8 owed was the **audit**: that all nine types exist, carry exactly the
payload §3.6 names, and fire when the rules say they fire.

The audit found a real defect on its first pass — see below.

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/cartActions.ts` | The one implementation of D22's fire-on-0↔1 rule. |
| `src/components/SmartCartPanel.tsx` | Row stepper routed through it — **this is the fix**. |
| `src/components/CartLine.tsx` | Same, replacing its own copy of the rule. |
| `src/components/ProductCard.tsx` | Same. |

No component mutates the cart directly any more; every add, increment and
decrement goes through `cartActions.ts`.

## How to run

```bash
node phases/phase-8-events/verify_events.ts
```

## What the audit found

**The Smart Cart panel's own row stepper removed a product from the cart without
logging `cart_remove`.**

D22 is explicit that `cart_remove` fires on the ≥1 → 0 transition "whichever
control triggered it". `CartLine` and `ProductCard` each implemented that
correctly. The panel's row stepper — added in Phase 5, after D22 was written —
called `removeFromCart` directly and logged nothing.

It is a narrow path: a panel row only shows a stepper at quantity ≥ 1, which on
that surface means during the row's 220ms exit animation after ADD. But it is
reachable, it was reproduced live, and it is a product leaving the cart with no
event marking it — in a log whose entire purpose is attribution.

Three call sites implemented one rule and one of them drifted, so the fix was to
stop having three. `cartActions.ts` now owns it, and the rule is unit-tested
directly rather than through three components.

## Test results

### Spec test

> *Run a full flow — search, add two products, open cart, replace a row, add
> from the panel, dismiss. Inspect `sc_events`. Every event present, `panel_add`
> carries the correct `slot`, `recommend_call` carries a plausible `latencyMs`
> and the correct `outcome`.*

**PASS.** The flow produced 11 events covering all nine types, one session id,
full envelope on every entry:

```
search → cart_add → cart_add → recommend_call → panel_impression
      → panel_replace_open → panel_replace_done → panel_add → cart_add
      → cart_remove → panel_dismiss
```

| Clause | Evidence |
|---|---|
| Every event present | All nine types in one flow |
| `panel_add` carries the correct slot | `slot: "A"`, `position: 1` — on a **replaced** row, so it reports the row's true slot, not the replacement's provenance |
| `recommend_call` plausible and correct | `latencyMs: 1751`, `outcome: "model"` |

The attribution chain reads end to end:
`panel_replace_open p_01937` → `panel_replace_done p_01937 → p_01986` →
`panel_add p_01986` → `cart_add p_01986 source: "panel"`.

**The regression, reproduced live:** adding from the panel and then decrementing
on the panel's own stepper inside the exit window now produces
`panel_add → cart_add → cart_remove`, and the product leaves the cart. Before
this phase the third event did not exist.

### Verification suite — 43/43

| Group | Checks |
|---|---|
| All nine types, with the payload §3.6 names | 10 |
| The envelope every event shares | 6 |
| The cap, and what it costs (G3) | 4 |
| Logging never breaks the interaction (G2, C3, C4) | 5 |
| When cart events fire, at every surface (D22) | 12 |
| A full session reads as the story it was | 6 |

## Edge cases closed

| # | How |
|---|---|
| **G2** | `logEvent` returns early when `typeof window === "undefined"`. Tested as a **no-op** — the log is unchanged by a call with no window — rather than as "the log reads empty", which is not the same claim (see the gotcha below). |
| **G3** | The cap holds at `EVENT_LOG_CAP` (500) and drops oldest-first, trimming on write and never on read. The accepted cost is asserted rather than described: an impression can be evicted while a `panel_add` referring to it survives. **Accepted** — the spec's own full flow produces 10 events, so this needs ~50× a realistic session. The add still carries its own `slot`, so slot-level attribution — the thing §3.6 calls load-bearing — survives the loss. |
| **G4** | `recommend_call.latencyMs` is defined as the **client-side round trip**: measured across the `fetch` in `SmartCartPanel`, so it includes network time, because that is the wait the user actually experiences. A server-side measurement would exclude exactly the part most likely to vary in production. |

## Gotchas

- **"No window" does not mean "empty log".** `storage.ts` writes every value to
  a module-level in-memory map as well as to localStorage — that map is what
  keeps a session coherent when storage is unavailable (C3). It is module-global,
  so it survives a test's fake-window reset and still holds the previous block's
  events. The first version of the G2 check asserted `readEvents().length === 0`
  and failed for that reason. The property that actually matters is that the SSR
  guard makes `logEvent` a **no-op**, which is what is now asserted.
- **`recommend_call` is not logged on a cache hit.** The event describes a call;
  a panel served from `sc_panel_cache` made none. A reader expecting one event
  per panel *view* will undercount views — impressions are the right event for
  that, and they fire on every mount.
- **`panel_impression` reports the rows as first shown**, before any Browse &
  Replace. It fires once per mount from `state.response.rows`, not from the
  replacement overlay, so an impression is what the panel offered — and
  `panel_replace_done` is what the user did about it.
- **Increment logs nothing, deliberately.** `incrementProduct` exists as a named
  function rather than a bare `addToCart` call precisely so the absence of an
  event is a visible decision at the place someone would add one. (D22)
