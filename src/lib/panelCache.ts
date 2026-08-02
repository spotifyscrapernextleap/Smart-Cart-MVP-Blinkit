/**
 * The panel cache, keyed by cart signature. (Build spec §4, Steps 2 and 12)
 *
 * A repeat visit to the same cart renders instantly and identically, with no
 * network call — which is also what stops the four rows reshuffling every time
 * the user glances at their bill.
 *
 * Entries are capped: one is written per distinct cart taken to checkout, so
 * uncapped it grows for the life of the browser profile. (EDGE_CASES C7)
 */

import { hasProduct } from "./catalogue.ts";
import { PANEL_CACHE_MAX_ENTRIES } from "./config.ts";
import { STORAGE_KEYS, getItem, isPanelCache, setItem } from "./storage.ts";
import type { CartSignature, RecommendResponse } from "./types";

function readAll(): Record<string, RecommendResponse> {
  return getItem<Record<string, RecommendResponse>>(
    STORAGE_KEYS.panelCache,
    {},
    isPanelCache
  );
}

/**
 * A cached panel is only usable if every product it names still exists.
 *
 * Product ids are positional and shift whenever the catalogue is rebuilt, so a
 * cache written before a rebuild can reference products that are now gone — the
 * same failure the cart guards against, arriving by a different route.
 * (EDGE_CASES C2)
 */
function isStillValid(panel: RecommendResponse): boolean {
  if (!Array.isArray(panel.rows) || panel.rows.length === 0) return false;
  if (!panel.rows.every((row) => hasProduct(row.productId))) return false;
  return Object.values(panel.shortlists ?? {}).every(
    (ids) => Array.isArray(ids) && ids.every(hasProduct)
  );
}

export function getCachedPanel(signature: CartSignature): RecommendResponse | null {
  const entry = readAll()[signature];
  if (!entry) return null;
  return isStillValid(entry) ? entry : null;
}

export function setCachedPanel(
  signature: CartSignature,
  panel: RecommendResponse
): void {
  const all = readAll();

  // Re-inserting moves a signature to the end, so the eviction below drops the
  // least recently *written* entry rather than an arbitrary one.
  delete all[signature];
  all[signature] = panel;

  const keys = Object.keys(all);
  if (keys.length > PANEL_CACHE_MAX_ENTRIES) {
    for (const stale of keys.slice(0, keys.length - PANEL_CACHE_MAX_ENTRIES)) {
      delete all[stale];
    }
  }

  setItem(STORAGE_KEYS.panelCache, all);
}
