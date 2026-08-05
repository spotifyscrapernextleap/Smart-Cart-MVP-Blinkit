import {
  DELIVERY_FEE_ORIGINAL,
  HANDLING_CHARGE,
  SPECIAL_DEAL_MAX_PRICE,
  SUGGESTED_PRODUCT_COUNT,
} from "./config.ts";
import { getProduct, getProductsByTile } from "./catalogue.ts";
import type { CartLine, Product } from "./types";

/**
 * The checkout page's non-recommendation logic: what to suggest alongside the
 * cart, and what the bill adds up to.
 *
 * **This module must never become a second discovery surface.** The Smart Cart
 * panel exists to surface tiles the persona does *not* shop — dormant and
 * never-bought — and it explicitly excludes every tile represented in the cart
 * (D1a). Everything here does the exact opposite: it draws **only** from tiles
 * already in the cart. The two are disjoint by construction, not by tuning, so
 * "You might also like" reads as more-of-what-you-are-buying and the panel
 * remains the only place the app proposes something new. `verify_checkout.ts`
 * asserts the disjointness on every cart it tests.
 */

/** Products from the cart's own tiles, best-selling first, cart contents removed. */
function relatedCandidates(lines: CartLine[]): Product[] {
  const inCart = new Set(lines.map((line) => line.productId));

  // Cart order, de-duplicated: the tile of the first line leads the list, so
  // the grid opens with complements to what the user added first.
  const tiles: string[] = [];
  for (const line of lines) {
    const product = getProduct(line.productId);
    if (product && !tiles.includes(product.tile)) tiles.push(product.tile);
  }

  // Round-robin across tiles rather than draining the first one. A two-tile
  // cart otherwise fills all six slots from whichever tile came first, and the
  // grid stops looking like it read the basket.
  const pools = tiles.map((tile) =>
    getProductsByTile(tile).filter((product) => !inCart.has(product.id)),
  );

  const out: Product[] = [];
  for (let depth = 0; out.length < pools.length * 32; depth += 1) {
    let exhausted = true;
    for (const pool of pools) {
      if (depth < pool.length) {
        out.push(pool[depth]);
        exhausted = false;
      }
    }
    if (exhausted) break;
  }
  return out;
}

/**
 * The "You might also like" grid.
 *
 * Returns fewer than `SUGGESTED_PRODUCT_COUNT` — possibly zero — when the
 * cart's tiles cannot supply that many. The section renders nothing at zero
 * rather than showing an empty frame.
 */
export function getSuggestedProducts(lines: CartLine[]): Product[] {
  return relatedCandidates(lines).slice(0, SUGGESTED_PRODUCT_COUNT);
}

/**
 * The single "Special deal for you!" product.
 *
 * Taken from the same cart-adjacent pool, but from *below* the grid, so the
 * deal is never a product already shown six rows down.
 *
 * Selected by **percentage** off, under `SPECIAL_DEAL_MAX_PRICE`. Both halves
 * of that matter, and the first build got it wrong: ranking by *absolute*
 * saving selects whatever is most expensive, which offered a ₹1,508 eau de
 * toilette next to ₹81 noodles. A deal card is an impulse add, so it is capped
 * and returns `undefined` when nothing cheap enough is discounted — the
 * section then does not render, which is better than an absurd deal.
 */
export function getSpecialDeal(lines: CartLine[]): Product | undefined {
  const shown = new Set(getSuggestedProducts(lines).map((p) => p.id));
  const affordable = relatedCandidates(lines).filter(
    (p) => !shown.has(p.id) && p.mrp > p.price && p.price <= SPECIAL_DEAL_MAX_PRICE,
  );
  if (affordable.length === 0) return undefined;

  // Deterministic: deepest discount, then cheaper, then id — so the card does
  // not change between two renders of the same cart.
  return affordable.reduce((best, p) => {
    const pct = discountPercent(p);
    const bestPct = discountPercent(best);
    if (pct !== bestPct) return pct > bestPct ? p : best;
    if (p.price !== best.price) return p.price < best.price ? p : best;
    return p.id < best.id ? p : best;
  });
}

export interface Bill {
  /** Sum of `mrp × quantity`. Equals `itemsTotal` when nothing is discounted. */
  itemsMrpTotal: number;
  /** Sum of `price × quantity`. The cart subtotal. */
  itemsTotal: number;
  /** `itemsMrpTotal − itemsTotal`. Zero when nothing in the cart is discounted. */
  itemsSaved: number;
  deliveryFeeOriginal: number;
  handlingCharge: number;
  donation: number;
  tip: number;
  grandTotal: number;
  /** Item savings plus the waived delivery fee. What the blue banner reports. */
  totalSavings: number;
}

/**
 * Bill arithmetic, in one place so the summary and the Place Order bar cannot
 * disagree about the total — they read the same object.
 *
 * Delivery is free, so it contributes to savings and never to the total.
 */
export function computeBill(
  lines: CartLine[],
  { donation = 0, tip = 0 }: { donation?: number; tip?: number } = {},
): Bill {
  let itemsMrpTotal = 0;
  let itemsTotal = 0;

  for (const line of lines) {
    const product = getProduct(line.productId);
    if (!product) continue;
    itemsTotal += product.price * line.quantity;
    // mrp is occasionally below price in the source dump; clamp so a bad row
    // can never render as a negative saving.
    itemsMrpTotal += Math.max(product.mrp, product.price) * line.quantity;
  }

  const itemsSaved = itemsMrpTotal - itemsTotal;

  return {
    itemsMrpTotal,
    itemsTotal,
    itemsSaved,
    deliveryFeeOriginal: DELIVERY_FEE_ORIGINAL,
    handlingCharge: HANDLING_CHARGE,
    donation,
    tip,
    grandTotal: itemsTotal + HANDLING_CHARGE + donation + tip,
    totalSavings: itemsSaved + DELIVERY_FEE_ORIGINAL,
  };
}

/** Percentage off MRP, floored. Zero when the product carries no discount. */
export function discountPercent(product: Product): number {
  if (product.mrp <= product.price) return 0;
  return Math.floor(((product.mrp - product.price) / product.mrp) * 100);
}
