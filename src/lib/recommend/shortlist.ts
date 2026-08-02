/**
 * Tile selection and candidate filtering. (Build spec §4, Steps 6 and 7)
 *
 * Everything the spec calls non-negotiable is enforced here, before the model is
 * ever involved — the model only chooses *which* product fills a position it has
 * been handed, and cannot violate a rule it never had the opportunity to break.
 *
 * Four exclusions, in order:
 *
 *   1. Tiles already represented in the cart are dropped entirely. (EDGE_CASES D1a)
 *   2. Products already in the cart are dropped from every shortlist. (EDGE_CASES D1)
 *   3. Dormant shortlists drop durables the persona already owns. (spec §4 Step 7)
 *   4. Never-bought shortlists drop anything above the price ceiling. (spec §4 Step 7)
 */

import { getProduct, getProductsByTile, getTile } from "../catalogue.ts";
import {
  DORMANT_TILES_OFFERED,
  MAX_TILES_PER_SECTION_OFFERED,
  NEVERBOUGHT_TILES_OFFERED,
  PRICE_CEILING_FLOOR,
  PRICE_CEILING_RATIO,
  SHORTLIST_SIZE,
} from "../config.ts";
import type { CartLine, Product, SlotType, TileId, TileStats } from "../types";

import { getClassification, getTilesByClass } from "./dormancy.ts";

export interface Shortlist {
  tile: TileId;
  tileLabel: string;
  slot: SlotType;
  /** Ranked, already filtered, at most SHORTLIST_SIZE. Never empty. */
  products: Product[];
  /** Dormant tiles only — supplies the reason line's "n weeks ago". */
  mostRecentDaysAgo: number | null;
}

export interface ShortlistSet {
  dormant: Shortlist[];
  neverBought: Shortlist[];
  subtotal: number;
  priceCeiling: number;
}

/** max(PRICE_CEILING_FLOOR, subtotal × PRICE_CEILING_RATIO). No upper cap. */
export function computePriceCeiling(subtotal: number): number {
  return Math.max(PRICE_CEILING_FLOOR, subtotal * PRICE_CEILING_RATIO);
}

export function computeSubtotal(cart: CartLine[]): number {
  return cart.reduce((sum, line) => {
    const product = getProduct(line.productId);
    return product ? sum + product.price * line.quantity : sum;
  }, 0);
}

function tilesInCart(cart: CartLine[]): Set<TileId> {
  const inCart = new Set<TileId>();
  for (const line of cart) {
    const product = getProduct(line.productId);
    if (product) inCart.add(product.tile);
  }
  return inCart;
}

/**
 * Dormant tiles, most recently lapsed first.
 *
 * Spec §4 Step 6: a tile dormant 35 days is a better reactivation bet than one
 * dormant 300 days. Ties break on tile id purely so the output is deterministic.
 */
function orderDormantTiles(candidates: TileStats[]): TileStats[] {
  return [...candidates].sort((a, b) => {
    const byRecency = (a.mostRecentDaysAgo ?? 0) - (b.mostRecentDaysAgo ?? 0);
    return byRecency !== 0 ? byRecency : a.tile.localeCompare(b.tile);
  });
}

/**
 * Never-bought tiles, least-explored section first.
 *
 * The spec says to sort these by "bestsellerRank of their top product ascending",
 * but every tile has a rank-1 product, so that key ties all seventeen ways and
 * collapses to array order — which offers oil, dry fruits, meat and kitchenware,
 * none of which is what this feature exists to surface. (EDGE_CASES D6)
 *
 * The tie is broken on how many orders the persona has placed in the tile's
 * *section*. That is a real signal drawn from real history rather than an
 * invented weight: this persona has 97 orders in Grocery & Kitchen and **zero**
 * in Beauty & Personal Care, so the seven Beauty tiles lead. It also lines up
 * with the idea doc, where beauty and personal care is one of the two most
 * refused categories and therefore exactly the awareness gap the panel targets.
 *
 * A per-section cap then stops all four offered tiles collapsing into one
 * section, so the model — and Browse & Replace — still has a genuine choice,
 * while every option remains in a section the persona has barely touched.
 * The spec's bestsellerRank rule is preserved as the second key.
 */
function orderNeverBoughtTiles(candidates: TileStats[]): TileStats[] {
  const { ordersBySection } = getClassification();

  const sectionOf = (stats: TileStats) => getTile(stats.tile)?.section ?? "";
  const topRankOf = (stats: TileStats) =>
    getProductsByTile(stats.tile)[0]?.bestsellerRank ?? Number.MAX_SAFE_INTEGER;

  const sorted = [...candidates].sort((a, b) => {
    const bySection =
      (ordersBySection.get(sectionOf(a)) ?? 0) - (ordersBySection.get(sectionOf(b)) ?? 0);
    if (bySection !== 0) return bySection;
    const byRank = topRankOf(a) - topRankOf(b);
    return byRank !== 0 ? byRank : a.tile.localeCompare(b.tile);
  });

  // Cap per section, then append whatever was held back so the list is still a
  // complete ordering — the caller may need to reach past the cap if earlier
  // tiles yield empty shortlists.
  const taken: TileStats[] = [];
  const overflow: TileStats[] = [];
  const perSection = new Map<string, number>();

  for (const stats of sorted) {
    const section = sectionOf(stats);
    const used = perSection.get(section) ?? 0;
    if (used < MAX_TILES_PER_SECTION_OFFERED) {
      perSection.set(section, used + 1);
      taken.push(stats);
    } else {
      overflow.push(stats);
    }
  }

  return [...taken, ...overflow];
}

/**
 * Walks tiles in the given order, building a shortlist for each and skipping any
 * that filter down to nothing, until `wanted` shortlists exist or the candidates
 * run out. Spec §4 Step 7: "If a shortlist ends up empty after filtering, drop
 * that tile and take the next-ranked tile of the same type."
 */
function collectShortlists(
  ordered: TileStats[],
  slot: SlotType,
  wanted: number,
  filter: (product: Product) => boolean
): Shortlist[] {
  const shortlists: Shortlist[] = [];

  for (const stats of ordered) {
    if (shortlists.length >= wanted) break;

    const products = getProductsByTile(stats.tile).filter(filter).slice(0, SHORTLIST_SIZE);
    if (products.length === 0) continue;

    shortlists.push({
      tile: stats.tile,
      tileLabel: getTile(stats.tile)?.label ?? stats.tile,
      slot,
      products,
      mostRecentDaysAgo: stats.mostRecentDaysAgo,
    });
  }

  return shortlists;
}

export function buildShortlists(cart: CartLine[]): ShortlistSet {
  const { ownedProductIds } = getClassification();

  const cartProductIds = new Set(cart.map((line) => line.productId));
  const cartTiles = tilesInCart(cart);

  const subtotal = computeSubtotal(cart);
  const priceCeiling = computePriceCeiling(subtotal);

  const notInCart = (product: Product) => !cartProductIds.has(product.id);

  const dormantCandidates = getTilesByClass("dormant").filter((s) => !cartTiles.has(s.tile));
  const neverCandidates = getTilesByClass("never-bought").filter((s) => !cartTiles.has(s.tile));

  const dormant = collectShortlists(
    orderDormantTiles(dormantCandidates),
    "A",
    DORMANT_TILES_OFFERED,
    // A consumable the persona let lapse is exactly what we want to resurface.
    // A durable they already own is not — they have one.
    (product) => notInCart(product) && !(ownedProductIds.has(product.id) && !product.isConsumable)
  );

  const neverBought = collectShortlists(
    orderNeverBoughtTiles(neverCandidates),
    "B",
    NEVERBOUGHT_TILES_OFFERED,
    (product) => notInCart(product) && product.price <= priceCeiling
  );

  return { dormant, neverBought, subtotal, priceCeiling };
}
