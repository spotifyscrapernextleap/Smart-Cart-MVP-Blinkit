/**
 * Tile classification against the persona's purchase history. (Build spec §4, Step 5)
 *
 * Walks every order once and derives, per tile: how many orders touched it, how
 * long ago the most recent one was, and therefore whether it is active, dormant
 * or never-bought. Also collects every product the persona has ever owned, which
 * is what makes the durable-exclusion rule possible.
 *
 * History is a committed seed file that never mutates at runtime, so the result
 * is computed once and memoised. `daysAgo` offsets rather than absolute dates
 * mean this stays correct no matter when the app is opened. (Build spec §3.3)
 */

import historyJson from "../../../data/history.json" with { type: "json" };

import { getProduct, tiles } from "../catalogue.ts";
import { DORMANCY_THRESHOLD_DAYS, TENURE_MIN_DAYS } from "../config.ts";
import type { History, ProductId, TileClass, TileId, TileStats } from "../types";

const history = historyJson as History;

export interface Classification {
  /** One entry per tile in tiles.json, including never-bought ones. */
  statsByTile: Map<TileId, TileStats>;
  /** Every product appearing anywhere in the history. */
  ownedProductIds: Set<ProductId>;
  /**
   * Orders the persona has placed in each section. The basis of never-bought
   * tile ordering — see shortlist.ts.
   */
  ordersBySection: Map<string, number>;
  /** Tenure gate. Seed data satisfies it; see spec §8 on why it is not a visible behaviour. */
  isEligible: boolean;
}

function classify(orderCount: number, mostRecentDaysAgo: number | null): TileClass {
  if (orderCount === 0) return "never-bought";
  if (mostRecentDaysAgo !== null && mostRecentDaysAgo >= DORMANCY_THRESHOLD_DAYS) {
    return "dormant";
  }
  return "active";
}

function build(): Classification {
  const statsByTile = new Map<TileId, TileStats>();
  for (const tile of tiles) {
    statsByTile.set(tile.id, {
      tile: tile.id,
      orderCount: 0,
      mostRecentDaysAgo: null,
      classification: "never-bought",
    });
  }

  const ownedProductIds = new Set<ProductId>();

  for (const order of history.orders) {
    // A tile counts once per order however many of its products appear, or a
    // single big shop would read as several separate visits to that tile.
    const tilesInOrder = new Set<TileId>();

    for (const item of order.items) {
      const product = getProduct(item.productId);
      if (!product) continue; // ids are positional; a rebuilt catalogue can orphan one
      ownedProductIds.add(product.id);
      tilesInOrder.add(product.tile);
    }

    for (const tileId of tilesInOrder) {
      const stats = statsByTile.get(tileId);
      if (!stats) continue;
      stats.orderCount += 1;
      if (stats.mostRecentDaysAgo === null || order.daysAgo < stats.mostRecentDaysAgo) {
        stats.mostRecentDaysAgo = order.daysAgo;
      }
    }
  }

  const ordersBySection = new Map<string, number>();
  for (const tile of tiles) {
    const stats = statsByTile.get(tile.id)!;
    stats.classification = classify(stats.orderCount, stats.mostRecentDaysAgo);
    ordersBySection.set(
      tile.section,
      (ordersBySection.get(tile.section) ?? 0) + stats.orderCount
    );
  }

  return {
    statsByTile,
    ownedProductIds,
    ordersBySection,
    isEligible: history.user.accountAgeDays >= TENURE_MIN_DAYS,
  };
}

let cached: Classification | null = null;

export function getClassification(): Classification {
  cached ??= build();
  return cached;
}

export function getTilesByClass(target: TileClass): TileStats[] {
  const { statsByTile } = getClassification();
  return tiles
    .map((tile) => statsByTile.get(tile.id)!)
    .filter((stats) => stats.classification === target);
}

export function getPersona() {
  return history.user;
}
