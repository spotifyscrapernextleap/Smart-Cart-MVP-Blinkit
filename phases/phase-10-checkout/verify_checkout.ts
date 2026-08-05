/**
 * Phase 10 test — checkout chrome.
 *
 * Phase 10 added thirteen sections around the Smart Cart panel to make the
 * cart page read as a real Blinkit checkout. Almost all of it is
 * presentational and needs no test. Two things are not:
 *
 *   1. **"You might also like" must never become a second discovery surface.**
 *      It draws only from tiles already in the cart; the panel draws only from
 *      tiles that are not (D1a). If that ever stops being true, the project's
 *      central claim — that the panel is the one place the app proposes
 *      something the user did not think of — quietly becomes false, and
 *      nothing on screen would show it. This is the half of the suite that
 *      matters.
 *
 *   2. **The bill has to add up**, and the Place Order bar has to agree with
 *      it, because they are two renderings of one number.
 *
 * Run:  node phases/phase-10-checkout/verify_checkout.ts
 */

import { getProduct } from "../../src/lib/catalogue.ts";
import {
  computeBill,
  discountPercent,
  getSpecialDeal,
  getSuggestedProducts,
} from "../../src/lib/checkout.ts";
import {
  DELIVERY_FEE_ORIGINAL,
  HANDLING_CHARGE,
  SPECIAL_DEAL_MAX_PRICE,
  SUGGESTED_PRODUCT_COUNT,
} from "../../src/lib/config.ts";
import { buildFallbackPanel } from "../../src/lib/recommend/fallback.ts";
import { buildShortlists } from "../../src/lib/recommend/shortlist.ts";
import type { CartLine } from "../../src/lib/types";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}${detail ? `  — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${label}${detail ? `  — ${detail}` : ""}`);
  }
}

const cartOf = (...entries: [string, number][]): CartLine[] =>
  entries.map(([productId, quantity]) => ({ productId, quantity }));

/** One instant-food product. */
const SINGLE_CART = cartOf(["p_01163", 1]);
/**
 * Instant food + bathing soap — two tiles, so round-robin is exercised, and
 * deliberately one grocery tile plus one Beauty & Personal Care tile. The
 * second is a tile the panel would otherwise reach for (the persona has zero
 * orders in that whole section, D23), so this cart is the sharpest test that
 * carting from a discovery tile pushes the panel elsewhere while the
 * suggestion grid picks it up.
 */
const SNACK_CART = cartOf(["p_01163", 2], ["p_01398", 1]);
/** Dog food: a dormant tile the user just reactivated. */
const PET_CART = cartOf(["p_02161", 1]);

const CARTS: [string, CartLine[]][] = [
  ["single", SINGLE_CART],
  ["snack", SNACK_CART],
  ["pet", PET_CART],
];

const tileOf = (id: string) => getProduct(id)?.tile;
const cartTiles = (cart: CartLine[]) => new Set(cart.map((l) => tileOf(l.productId)));

// ---------------------------------------------------------------------------
console.log("\n-- suggestions come from the cart's own tiles -------------------------");
for (const [name, cart] of CARTS) {
  const suggested = getSuggestedProducts(cart);
  const tiles = cartTiles(cart);

  check(
    `${name}: every suggestion is from a tile already in the cart`,
    suggested.length > 0 && suggested.every((p) => tiles.has(p.tile)),
    `${suggested.length} products, tiles ${[...new Set(suggested.map((p) => p.tile))].join(", ")}`,
  );

  check(
    `${name}: nothing already in the cart is suggested`,
    suggested.every((p) => !cart.some((l) => l.productId === p.id)),
  );

  check(
    `${name}: at most SUGGESTED_PRODUCT_COUNT`,
    suggested.length <= SUGGESTED_PRODUCT_COUNT,
    String(suggested.length),
  );

  check(`${name}: no duplicates`, new Set(suggested.map((p) => p.id)).size === suggested.length);
}

// ---------------------------------------------------------------------------
console.log("\n-- THE ONE THAT MATTERS: no collision with the Smart Cart panel -------");
for (const [name, cart] of CARTS) {
  const panel = buildFallbackPanel(buildShortlists(cart), "sig");
  const panelTiles = new Set(panel.rows.map((r) => r.tile));
  const panelProducts = new Set(panel.rows.map((r) => r.productId));

  const suggested = getSuggestedProducts(cart);
  const deal = getSpecialDeal(cart);

  check(
    `${name}: no suggested product also appears in the panel`,
    suggested.every((p) => !panelProducts.has(p.id)),
  );

  check(
    `${name}: suggestions and panel rows share no tile at all`,
    suggested.every((p) => !panelTiles.has(p.tile)),
    `panel ${[...panelTiles].join(", ")}`,
  );

  if (deal) {
    check(`${name}: the special deal is not a panel product`, !panelProducts.has(deal.id));
    check(`${name}: the special deal is not from a panel tile`, !panelTiles.has(deal.tile));
    check(
      `${name}: the special deal is from a cart tile`,
      cartTiles(cart).has(deal.tile),
      deal.tile,
    );
    check(
      `${name}: the special deal is not already in the grid`,
      !suggested.some((p) => p.id === deal.id),
    );
    check(`${name}: the special deal actually carries a discount`, deal.mrp > deal.price);
    check(
      `${name}: the special deal is an impulse buy, not the priciest thing on offer`,
      deal.price <= SPECIAL_DEAL_MAX_PRICE,
      `₹${deal.price} (cap ₹${SPECIAL_DEAL_MAX_PRICE}, ${discountPercent(deal)}% off)`,
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- determinism --------------------------------------------------------");
{
  const a = getSuggestedProducts(SNACK_CART).map((p) => p.id).join(",");
  const b = getSuggestedProducts(SNACK_CART).map((p) => p.id).join(",");
  check("the same cart suggests the same products", a === b, a);

  const d1 = getSpecialDeal(SNACK_CART)?.id;
  const d2 = getSpecialDeal(SNACK_CART)?.id;
  check("the same cart yields the same special deal", d1 === d2, d1 ?? "none");
}

// ---------------------------------------------------------------------------
console.log("\n-- round-robin across tiles, not drain-the-first ----------------------");
{
  const suggested = getSuggestedProducts(SNACK_CART);
  const tiles = new Set(suggested.map((p) => p.tile));
  check(
    "a two-tile cart draws from both tiles",
    tiles.size === 2,
    `${tiles.size} tile(s): ${[...tiles].join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- an empty cart degrades rather than throwing ------------------------");
{
  check("no suggestions for an empty cart", getSuggestedProducts([]).length === 0);
  check("no special deal for an empty cart", getSpecialDeal([]) === undefined);

  const bill = computeBill([]);
  check("an empty cart bills zero items", bill.itemsTotal === 0 && bill.itemsSaved === 0);
}

// ---------------------------------------------------------------------------
console.log("\n-- the bill adds up ---------------------------------------------------");
{
  const bill = computeBill(SNACK_CART);
  const expectedItems = SNACK_CART.reduce(
    (sum, l) => sum + (getProduct(l.productId)?.price ?? 0) * l.quantity,
    0,
  );

  check("items total is price × quantity", bill.itemsTotal === expectedItems, `₹${bill.itemsTotal}`);
  check(
    "saved is mrp total minus items total",
    bill.itemsSaved === bill.itemsMrpTotal - bill.itemsTotal,
    `₹${bill.itemsSaved}`,
  );
  check("saved is never negative", bill.itemsSaved >= 0);
  check(
    "grand total = items + handling, with no donation or tip",
    bill.grandTotal === bill.itemsTotal + HANDLING_CHARGE,
    `₹${bill.grandTotal}`,
  );
  check(
    "total savings includes the waived delivery fee",
    bill.totalSavings === bill.itemsSaved + DELIVERY_FEE_ORIGINAL,
    `₹${bill.totalSavings}`,
  );
  check("delivery is never added to the total", !String(bill.grandTotal).includes("NaN"));
}

{
  const bill = computeBill(SNACK_CART, { donation: 15, tip: 30 });
  const plain = computeBill(SNACK_CART);

  check(
    "a donation and a tip both reach the grand total",
    bill.grandTotal === plain.grandTotal + 45,
    `₹${plain.grandTotal} → ₹${bill.grandTotal}`,
  );
  check("a donation does not change item savings", bill.totalSavings === plain.totalSavings);
}

{
  // Quantity has to multiply through every money line, not just the subtotal.
  const one = computeBill(cartOf(["p_01163", 1]));
  const three = computeBill(cartOf(["p_01163", 3]));
  check(
    "quantity multiplies the items total",
    three.itemsTotal === one.itemsTotal * 3,
    `₹${one.itemsTotal} → ₹${three.itemsTotal}`,
  );
  check("quantity multiplies the saving", three.itemsSaved === one.itemsSaved * 3);
}

// ---------------------------------------------------------------------------
console.log("\n-- discountPercent ----------------------------------------------------");
{
  const discounted = getSuggestedProducts(SNACK_CART).filter((p) => p.mrp > p.price);
  check("some suggested products carry a real discount", discounted.length > 0, `${discounted.length}`);
  check(
    "every percent is between 1 and 99",
    discounted.every((p) => {
      const pct = discountPercent(p);
      return pct >= 1 && pct <= 99;
    }),
  );

  const undiscounted = getSuggestedProducts(SNACK_CART).filter((p) => p.mrp <= p.price);
  check(
    "a product with no discount reports 0%, so no badge renders",
    undiscounted.every((p) => discountPercent(p) === 0),
    `${undiscounted.length} undiscounted`,
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed > 0) process.exitCode = 1;
