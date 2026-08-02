/**
 * The deterministic panel. (Build spec §4, Step 10)
 *
 * Built first and deliberately: the fallback is the panel's default state and
 * the model is an enhancement layered on top, not an error handler bolted on at
 * the end. This path renders four correct rows with no API key present, and
 * everything the spec calls non-negotiable is already guaranteed here.
 *
 * Slot allocation is 2 + 2 whenever the shortlists allow it. When they do not,
 * the panel still renders four rows and backfills from the other slot type —
 * and the row reports the slot it **actually is**, never the position it
 * happens to occupy. Mislabelling a backfilled row would corrupt exactly the
 * slot-level attribution the idea doc names as this feature's main defence
 * against its own most likely failure mode. (EDGE_CASES D2)
 */

import type { PanelRow, RecommendResponse, TileId, ProductId } from "../types";

import type { Shortlist, ShortlistSet } from "./shortlist.ts";
import { dormantReason, neverBoughtReason } from "./templates.ts";

/** Rows are ordered A, A, B, B — dormant first — and positions follow that order. */
export const PANEL_ROW_COUNT = 4;
export const SLOTS_PER_TYPE = PANEL_ROW_COUNT / 2;

function reasonFor(shortlist: Shortlist): string {
  return shortlist.slot === "A"
    ? dormantReason(shortlist.tileLabel, shortlist.mostRecentDaysAgo)
    : neverBoughtReason();
}

/**
 * Chooses which shortlists fill the four rows.
 *
 * Takes two of each type where possible, then backfills any shortfall from
 * whatever the other type has left over, preserving each shortlist's true slot.
 */
export function selectPanelShortlists(set: ShortlistSet): Shortlist[] {
  const dormant = set.dormant.slice(0, SLOTS_PER_TYPE);
  const neverBought = set.neverBought.slice(0, SLOTS_PER_TYPE);

  const spareDormant = set.dormant.slice(SLOTS_PER_TYPE);
  const spareNeverBought = set.neverBought.slice(SLOTS_PER_TYPE);

  while (dormant.length + neverBought.length < PANEL_ROW_COUNT) {
    if (neverBought.length < SLOTS_PER_TYPE && spareDormant.length > 0) {
      dormant.push(spareDormant.shift()!);
    } else if (dormant.length < SLOTS_PER_TYPE && spareNeverBought.length > 0) {
      neverBought.push(spareNeverBought.shift()!);
    } else if (spareDormant.length > 0) {
      dormant.push(spareDormant.shift()!);
    } else if (spareNeverBought.length > 0) {
      neverBought.push(spareNeverBought.shift()!);
    } else {
      break; // genuinely nothing left; the panel renders short rather than lying
    }
  }

  return [...dormant, ...neverBought];
}

/**
 * Builds rows from already-chosen products.
 *
 * Shared with the model path, which supplies its own product choice and,
 * optionally, its own reason line per shortlist. `chooseProduct` returning
 * undefined falls back to the top-ranked product, so a bad model pick degrades
 * to the deterministic one.
 *
 * **A reason only survives alongside the product it was written about.** If the
 * returned id is not in this shortlist it is ignored — but so is the line, which
 * was written about a product that is no longer being shown. Keeping the two
 * independent would leave the panel displaying the top-ranked product wearing a
 * sentence about a different one, which is the plausible-looking version of the
 * failure the id check exists to prevent.
 */
export function buildRows(
  shortlists: Shortlist[],
  chooseProduct?: (shortlist: Shortlist) => { productId: ProductId; reason?: string } | undefined
): PanelRow[] {
  return shortlists.map((shortlist, index) => {
    const chosen = chooseProduct?.(shortlist);
    const picked = chosen
      ? shortlist.products.find((p) => p.id === chosen.productId)
      : undefined;
    const product = picked ?? shortlist.products[0];

    return {
      productId: product.id,
      slot: shortlist.slot,
      tile: shortlist.tile,
      reason: picked && chosen?.reason ? chosen.reason : reasonFor(shortlist),
      position: index + 1,
    };
  });
}

/**
 * The full ranked lists for the chosen tiles, which is what Browse & Replace
 * reads from — so opening the sheet costs no second network call.
 */
export function buildShortlistMap(shortlists: Shortlist[]): Record<TileId, ProductId[]> {
  const map: Record<TileId, ProductId[]> = {};
  for (const shortlist of shortlists) {
    map[shortlist.tile] = shortlist.products.map((product) => product.id);
  }
  return map;
}

export function buildFallbackPanel(
  set: ShortlistSet,
  cartSignature: string
): RecommendResponse {
  const chosen = selectPanelShortlists(set);
  return {
    source: "fallback",
    cartSignature,
    rows: buildRows(chosen),
    shortlists: buildShortlistMap(chosen),
  };
}
