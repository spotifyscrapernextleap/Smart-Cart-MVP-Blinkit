# Phase 10 — Checkout chrome

**Status:** complete, all tests pass
**Not in the build spec.** Owner-requested after Phase 9, from screenshots of
the real Blinkit checkout.
**Verification:** `node phases/phase-10-checkout/verify_checkout.ts` — 55/55

The cart page had four sections. A real Blinkit checkout has fourteen. The
Smart Cart panel was being evaluated on a bare page that flattered it, and the
ask was to put it in the context it would actually ship in.

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/checkout.ts` | Related-product selection and all bill arithmetic |
| `src/components/SuggestedProductCard.tsx` | The rich Blinkit-style product card |
| `src/components/YouMightAlsoLike.tsx` | Six cart-adjacent complements |
| `src/components/SpecialDeal.tsx` | One discounted impulse add |
| `src/components/DonationCard.tsx` | "You are feeding India" — wired to the bill |
| `src/components/TipCard.tsx` | Delivery-partner tip — wired to the bill |
| `src/components/CheckoutExtras.tsx` | Coupons, GSTIN, delivery instructions, gifting, cancellation |
| `src/components/PlaceOrderBar.tsx` | Sticky footer — deliberately inert |
| `src/components/StarRating.tsx` | Four frozen stars |
| `BillDetails.tsx`, `CartLine.tsx`, `cart/page.tsx` | Rewritten / assembled |

## The one thing that could have broken the project

**"You might also like" sits on the same page as the Smart Cart panel, and both
recommend products.** If they overlapped, the feature's whole claim — that the
panel is the one place the app proposes something the user did not think of —
would quietly become false, and nothing on screen would reveal it.

They cannot overlap, and not because the numbers were tuned:

- The **panel** draws only from dormant and never-bought tiles, and explicitly
  excludes every tile represented in the cart (D1a).
- **Everything added here** draws *only* from tiles already in the cart.

The two sets are complements of each other, so the sections are disjoint by
construction. `verify_checkout.ts` asserts it on three carts — including one
holding a Beauty & Personal Care product, the section the panel most wants to
reach for (D23) — checking that no suggested product and **no suggested tile**
ever appears in the panel. That group is the reason this suite exists.

The panel also did not move. It is still the immediate sibling of the cart
lines inside the same card, 0px gap, measured after the rewrite. Everything
Phase 10 added sits either above the basket or below the bill.

## Test results

**55/55.** Verified live at 375px:

| Check | Evidence |
|---|---|
| Panel position unchanged | card children are `[UL, SECTION]`, gap above panel `0px` |
| No suggestion/panel collision | 3 carts × products and tiles — all disjoint |
| Bill arithmetic | items ₹308 → ₹270 (saved ₹38), handling ₹12, grand ₹282, savings ₹68 |
| Donation reaches the total | ₹15 tapped → bill line appears, grand ₹282 → ₹297 |
| Bill and Place Order bar agree | both read ₹297 — they share one `Bill` object |
| Attribution intact | ADD in the grid logs `cart_add { source: "suggested" }` |
| Four stars, every card | 24 filled stars across 6 cards |
| Place Order is not pressable | no `<button>` matches "Place Order" |
| No horizontal overflow | `body.scrollWidth` 375 = viewport, 0 elements past the edge |
| Console | no errors |

## Decisions

**D40 — Fabricated product attributes are out; the shapes that hold them stay.**
Owner's decision. Sizes ("400 g"), review counts ("1.4 lac") and attribute
badges ("90 days Shelf Life") are not in our data and are not invented. Stars
are frozen at `SUGGESTED_STAR_RATING` (4) for every product. The reasoning is
that this app's premise is a *real* persona with *real* purchase history, and a
varying rating would be the only number on the page that means nothing — with
no way for a reader to tell it apart from the ones that do. A constant is
visibly furniture.

**D41 — Discount pricing is real, and comes from `mrp`, which was already there.**
This reverses D29's "no struck-through mrp" for the cart lines, the suggestion
grid and the deal card — but **not for the Smart Cart panel rows**, which stay
plain. D29's actual concern was that a discount treatment makes recommendation
lift and discount lift inseparable *on the surface being measured*; keeping the
panel clean preserves that while the rest of the page gets its realism. The
owner offered to fabricate prices for speed; using the existing `mrp` field was
less work than inventing numbers and needs no catalogue rebuild.

**D42 — "You might also like" sits below Bill details, not in its real slot.**
On real Blinkit it sits directly under the basket. That slot belongs to the
Smart Cart panel and the panel is the deliverable, so the grid moved below the
bill. This is the one place the reproduction is deliberately unfaithful.

**D43 — Inert chrome is not focusable.** The wishlist heart, "Move to wishlist",
category chips, coupons, GSTIN, delivery instructions and Place Order have no
behaviour in this build. Every one is rendered as a non-interactive element
with `aria-hidden` on its affordance — never a `<button>` or `<a>`. Chrome that
lies about being pressable is worse than chrome that is obviously decorative,
and a keyboard or screen-reader user is never handed a dead control.

**D44 — `cart_add.source` gains `"suggested"`.** Fourth value, after D37's
`"category"`, and for the same reason: attributing a related-product tap as a
search would inflate search's conversions, which is the error D22 exists to
prevent. It covers both the grid and the deal card — they are one channel, and
splitting them would divide a number too small to read.

**D45 is the next free number.**

## Gotchas

- **Ranking a deal by absolute discount always selects the most expensive
  product.** The first build of `getSpecialDeal` offered a **₹1,508 eau de
  toilette** beside ₹81 noodles — every rule held, and it read as a
  mis-targeted ad. A deal card is an impulse add. It now ranks by *percentage*
  under `SPECIAL_DEAL_MAX_PRICE` (150) and returns `undefined` rather than
  render an absurd one. Same shape of error as the Phase 4 gotcha about the
  baby-care slot-B pick: the rules were right and the result was still wrong.
- **The suggestion pool round-robins across cart tiles.** Draining the first
  tile filled all six slots from whichever product the user happened to add
  first, and the grid stopped looking like it had read the basket.
- **The deal card reuses `--color-panel-tint`, the Smart Cart colour.** Noted
  in the component: two tinted blocks on one page could read as one feature.
  They are currently told apart by position and content. If they ever start
  looking alike, the deal card is the one that should change colour.
- **`mrp` is occasionally *below* `price` in the source dump.** `computeBill`
  clamps with `Math.max`, so a bad row can never render as a negative saving,
  and `discountPercent` returns 0 so no badge appears.
- **Donation and tip are not persisted.** They are decisions about one order;
  `sc_*` storage is for state that must survive a reload. State lives in the
  cart page because Bill details and the Place Order bar both read it — that is
  also why they cannot disagree about the total.
- **Screenshots failed again.** The browser pane still does not composite, so
  every layout claim above is `getBoundingClientRect` and DOM text. The UI has
  now grown by ten sections and **still nobody has looked at it.**
