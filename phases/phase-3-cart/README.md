# Phase 3 — Cart

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 3 (3.1–3.4)
**Edge cases closed:** C2, C5, F8 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

Adds the cart: storage-backed logic, the ADD/stepper control, the sticky
view-cart bar, and the cart page itself.

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/cart.ts` | add, remove, setQuantity, subtotal, cartSignature — spec §3.1. Always reads through to storage; sanitises on every read. |
| `src/lib/useCart.ts` | `useCart()` / `useCartQuantity()` via `useSyncExternalStore`. |
| `src/components/QuantityStepper.tsx` | Shared ADD ⇄ stepper control. |
| `src/components/ViewCartBar.tsx` | Sticky bottom bar, hidden when the cart is empty. |
| `src/components/CartLine.tsx` | One cart-page line item. |
| `src/components/BillDetails.tsx` | Item total / to pay. |
| `src/app/cart/page.tsx` | CART — line items, empty state. Smart Cart panel lands here in Phase 5. |
| `src/components/ProductCard.tsx` | Wired to the cart; logs `cart_add`/`cart_remove`. |

## How to run

```bash
npm run dev
```

```bash
node phases/phase-3-cart/verify_cart.ts
```

## Test results

### Spec test

> *Add three products across two tiles, navigate to cart, see them with a
> correct subtotal. Refresh — cart persists. `?reset=1` — cart empties.*

**PASS**, verified live: added two MAGGI products (`instant-food`) and one
Dettol soap (`bath-body`) — three products, two tiles. Cart page showed all
three lines at ₹81 + ₹85 + ₹108 = **₹274**, matching Bill details exactly.
`window.location.reload()` — all three lines and the subtotal survived.
`/?reset=1` then `/cart` — empty-cart state, "Your cart is empty".

### Verification suite — `verify_cart.ts`

**PASS — 22/22.** Add/remove/setQuantity, quantity clamping, unknown ids,
stale-id healing with storage rewrite verified, defensive merge/drop of
hand-edited duplicate and invalid lines, `getSubtotal`/`getItemCount` against
real catalogue prices, `cartSignature`'s exact format, and subscription
add/notify/unsubscribe.

### Additional live checks

- ADD → stepper transition is instant with no page reload (`useSyncExternalStore`
  reactivity across components, confirmed on the search grid).
- `cart_add`/`cart_remove` fire **only on the 0↔1 transition** — confirmed by
  adding (1 add event), incrementing twice to quantity 3 (still 1 add event, 0
  remove events), decrementing to quantity 2 (still 0 remove events), then
  decrementing to 0 from the cart page's own stepper (exactly 1 remove event,
  line disappears, empty state renders).
- `ViewCartBar` renders on Home and Search, shows correct item count and
  subtotal, links to `/cart`, and is absent entirely when the cart is empty.
- No horizontal scroll at a 375px viewport.

## Decisions

Recorded as **D19–D22** in [`../../PROJECT_MEMORY.md`](../../PROJECT_MEMORY.md).
In brief: `cart.ts` always reads through to storage rather than caching, so a
catalogue rebuilt mid-session can't leave a stale reference behind; React
reactivity is `useSyncExternalStore`, not hand-rolled `useEffect`+`useState`,
because the lint rule `react-hooks/set-state-in-effect` correctly flagged the
first draft and the built-in hook is the actual right tool; `cart_add`/`cart_remove`
are scoped to entry/exit transitions only, not every tap, to keep
`source`-based channel attribution honest.

## Not done here, on purpose

- No Smart Cart panel. The comment `{/* Smart Cart panel — Phase 5 */}` marks
  where it inserts between cart lines and Bill details.
- No delivery/handling fee lines in `BillDetails` — neither doc specifies a fee
  model, and inventing one would misrepresent the deliverable.
- `F4` (double-tap guarding a panel ADD) is explicitly a Phase 5 concern, not
  this phase's plain quantity stepper, where a double tap correctly means
  "add two."
