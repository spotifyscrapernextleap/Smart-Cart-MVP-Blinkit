/**
 * Phase 5 test — src/lib/panelCache.ts.
 *
 * The interactive behaviour of the panel is verified in the browser (see this
 * phase's README); what is unit-testable is the cache underneath it: eviction,
 * and refusing to serve a panel whose products no longer exist.
 *
 * Run:  node phases/phase-5-panel-ui/verify_panel_cache.ts
 */

import { products } from "../../src/lib/catalogue.ts";
import { PANEL_CACHE_MAX_ENTRIES } from "../../src/lib/config.ts";
import { getCachedPanel, setCachedPanel } from "../../src/lib/panelCache.ts";
import { STORAGE_KEYS } from "../../src/lib/storage.ts";
import type { RecommendResponse } from "../../src/lib/types";

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

function freshWindow() {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage,
  };
  return map;
}

const realId = products[0].id;
const otherId = products[1].id;

function panelWith(productId: string): RecommendResponse {
  return {
    source: "fallback",
    cartSignature: "sig",
    rows: [{ productId, slot: "A", tile: "pet-store", reason: "because", position: 1 }],
    shortlists: { "pet-store": [productId] },
  };
}

// ---------------------------------------------------------------------------
console.log("\n-- round trip ------------------------------------------------------");
{
  freshWindow();
  check("an unknown signature returns null", getCachedPanel("nope") === null);

  setCachedPanel("sig-a", panelWith(realId));
  const got = getCachedPanel("sig-a");
  check("a stored panel comes back", got !== null && got.rows[0].productId === realId);
}

// ---------------------------------------------------------------------------
console.log("\n-- eviction (EDGE_CASES C7) ----------------------------------------");
{
  const map = freshWindow();
  const overflow = PANEL_CACHE_MAX_ENTRIES + 5;
  for (let i = 0; i < overflow; i += 1) {
    setCachedPanel(`sig-${i}`, panelWith(realId));
  }

  const stored = JSON.parse(map.get(STORAGE_KEYS.panelCache) ?? "{}");
  check(
    `the cache is capped at ${PANEL_CACHE_MAX_ENTRIES} entries`,
    Object.keys(stored).length === PANEL_CACHE_MAX_ENTRIES,
    `wrote ${overflow}, kept ${Object.keys(stored).length}`
  );
  check("the oldest signature was evicted", getCachedPanel("sig-0") === null);
  check(
    "the newest signature survived",
    getCachedPanel(`sig-${overflow - 1}`) !== null
  );
}

{
  const map = freshWindow();
  for (let i = 0; i < PANEL_CACHE_MAX_ENTRIES; i += 1) {
    setCachedPanel(`sig-${i}`, panelWith(realId));
  }
  // Re-writing an existing signature must not grow the cache, and must move it
  // to the most-recent position rather than leaving it first in line to evict.
  setCachedPanel("sig-0", panelWith(otherId));
  setCachedPanel("fresh", panelWith(realId));

  const stored = JSON.parse(map.get(STORAGE_KEYS.panelCache) ?? "{}");
  check(
    "re-writing a signature does not grow the cache past the cap",
    Object.keys(stored).length === PANEL_CACHE_MAX_ENTRIES,
    `${Object.keys(stored).length}`
  );
  check("a re-written signature is no longer the first to be evicted", getCachedPanel("sig-0") !== null);
  check("the signature after it was evicted instead", getCachedPanel("sig-1") === null);
}

// ---------------------------------------------------------------------------
console.log("\n-- stale product ids (EDGE_CASES C2) --------------------------------");
{
  freshWindow();
  // A panel cached before a catalogue rebuild can name products that no longer
  // exist — ids are positional, so this is the same hazard the cart guards
  // against, arriving by a different route.
  setCachedPanel("stale-row", panelWith("p_99999"));
  check("a panel whose row product is gone is not served", getCachedPanel("stale-row") === null);

  const badShortlist: RecommendResponse = {
    ...panelWith(realId),
    shortlists: { "pet-store": [realId, "p_99999"] },
  };
  setCachedPanel("stale-shortlist", badShortlist);
  check(
    "a panel whose shortlist references a gone product is not served",
    getCachedPanel("stale-shortlist") === null,
    "Browse & Replace would otherwise render a dead entry"
  );

  setCachedPanel("empty-rows", { ...panelWith(realId), rows: [] });
  check("a panel with no rows is not served", getCachedPanel("empty-rows") === null);
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
