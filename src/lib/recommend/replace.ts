/**
 * Browse & Replace. (Build spec §6 Phase 7, §4 Step 13)
 *
 * The sheet's contents and the swap itself are decided here rather than inside
 * the component, so both are testable without a browser — the same reason every
 * other rule in this feature lives in `lib`.
 *
 * No network call is involved anywhere in this file. The response already
 * carried the full ranked shortlist for each of the four chosen tiles, so
 * opening the sheet is a read from a value the panel already has.
 */

import { getProducts } from "../catalogue.ts";
import type { PanelRow, Product, ProductId } from "../types";

import { NEVER_BOUGHT_REASON } from "./templates.ts";

/**
 * What the sheet offers for one row.
 *
 * Two exclusions, and they are the same two the shortlist already applies at
 * the panel level — the sheet is a second surface onto the same candidates and
 * must not be a way around either rule:
 *
 *  1. The product currently on the row. Offering it as its own replacement is
 *     a no-op dressed as a choice. (spec 7.1)
 *  2. Anything already in the cart. Recommending what the user has already
 *     bought is D1, and the sheet is exactly where that rule would otherwise
 *     leak — the panel was computed once at mount, so by the time the sheet
 *     opens the cart may contain products the shortlist was built without.
 *     (EDGE_CASES F6)
 *
 * Ids run through the catalogue rather than being trusted, because a cached
 * panel can name products a rebuilt catalogue no longer has. Rank order is
 * preserved: `getProducts` keeps the order it is given, and the stored
 * shortlist is already in bestseller order.
 */
export function alternativesFor(
  shortlist: ProductId[] | undefined,
  displayedProductId: ProductId,
  cartProductIds: Iterable<ProductId>
): Product[] {
  if (!Array.isArray(shortlist)) return [];

  const inCart = new Set(cartProductIds);
  return getProducts(shortlist).filter(
    (product) => product.id !== displayedProductId && !inCart.has(product.id)
  );
}

/**
 * True when the row's control should open a sheet at all.
 *
 * A sheet with nothing in it is worse than no sheet: the user taps, something
 * appears, and it is empty. At a low price ceiling this is reachable — `D7`
 * records that `bath-body` has only four products under a ₹100 cap, and two of
 * them in the cart leaves one, which the displayed-product exclusion then takes
 * to zero. (EDGE_CASES F5)
 */
export function canBrowse(
  shortlist: ProductId[] | undefined,
  displayedProductId: ProductId,
  cartProductIds: Iterable<ProductId>
): boolean {
  return alternativesFor(shortlist, displayedProductId, cartProductIds).length > 0;
}

/**
 * Swaps the product on a row, keeping everything that identifies the row.
 *
 * `slot`, `position` and `tile` are preserved verbatim — spec 7.2 requires the
 * first two, and the third is what makes it a *replacement* rather than a
 * different recommendation. Slot in particular is load-bearing: a replaced row
 * that reported the wrong slot would corrupt exactly the per-slot attribution
 * the idea doc names as this feature's main defence. (D14)
 *
 * **The reason line survives only if it is a claim about the tile.**
 *
 *  - Slot A lines always are. Both routes that can produce one guarantee it:
 *    `dormantReason` builds the line from the tile label, and a model-written
 *    line is rejected unless it contains that label (E10). The tile does not
 *    change here, so the claim stays true.
 *  - Slot B lines carry no such guarantee. The model is asked for inference,
 *    and inference can be about the specific product — "handy for weekend
 *    baking" is fine above a cake mix and false above batteries. There is no
 *    way to tell which kind of line we hold, so it does not survive a change of
 *    product, and the template takes over.
 *
 * This is the same rule `buildRows` applies when it discards a reason whose
 * product was rejected: a line never outlives the product it was written about.
 */
export function applyReplacement(row: PanelRow, replacementProductId: ProductId): PanelRow {
  return {
    ...row,
    productId: replacementProductId,
    reason: row.slot === "A" ? row.reason : NEVER_BOUGHT_REASON,
  };
}
