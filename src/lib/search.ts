/**
 * Client-side search: alias rewriting, then Fuse.js.
 *
 * Typo tolerance is the real failure mode — a stranger types `colgat` — and
 * fuzzy matching handles that. What fuzzy matching cannot fix is a vocabulary
 * mismatch: the source dataset says "flour" where a shopper says "atta", and no
 * edit-distance threshold bridges that. Hence the alias pass first.
 */

import Fuse, { type IFuseOptions } from "fuse.js";

import aliasesJson from "../../data/search-aliases.json" with { type: "json" };

import { getProduct, getTileLabel, products } from "./catalogue.ts";
import {
  SEARCH_MAX_RESULTS,
  SEARCH_MAX_SCORE,
  SEARCH_THRESHOLD,
} from "./config.ts";
import type { Product, SearchAliases } from "./types";

const aliases = aliasesJson as SearchAliases;

/** Below this, fuzzy matching over 2,236 products returns noise. (EDGE_CASES B5) */
export const MIN_QUERY_LENGTH = 2;

// ---------------------------------------------------------------------------
// Alias rewriting
// ---------------------------------------------------------------------------

/**
 * Aliases split by shape. Multi-word keys must be matched as phrases and matched
 * FIRST, otherwise "cold drink" never fires because "cold" and "drink" are
 * considered separately.
 */
const phraseAliases = Object.entries(aliases)
  .filter(([key]) => key.includes(" "))
  .sort((a, b) => b[0].length - a[0].length);

const tokenAliases = new Map(
  Object.entries(aliases).filter(([key]) => !key.includes(" "))
);

function normalise(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrites a query through the alias map.
 *
 * Matching is on whole words only. A naive substring replace turns `dalchini`
 * into `dal pulses lentilchini` and `andaman` into `eggman`, because the map
 * contains short keys — `dal`, `tel`, `anda` — that are substrings of real
 * product words. (EDGE_CASES B2)
 */
export function rewriteQuery(query: string): string {
  let working = normalise(query);
  if (!working) return "";

  for (const [phrase, replacement] of phraseAliases) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, "giu");
    working = working.replace(pattern, replacement);
  }

  return working
    .split(" ")
    .map((token) => tokenAliases.get(token) ?? token)
    .join(" ")
    .trim();
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

interface IndexedProduct extends Product {
  /** Denormalised so Fuse can weight the tile label without a second lookup. */
  tileLabel: string;
}

const indexedProducts: IndexedProduct[] = products.map((product) => ({
  ...product,
  tileLabel: getTileLabel(product.tile),
}));

const fuseOptions: IFuseOptions<IndexedProduct> = {
  keys: [
    { name: "name", weight: 0.6 },
    { name: "brand", weight: 0.3 },
    { name: "tileLabel", weight: 0.1 },
  ],
  threshold: SEARCH_THRESHOLD,
  ignoreLocation: true,
  minMatchCharLength: MIN_QUERY_LENGTH,
  includeScore: true,
};

// Built once at module load. Fuse indexing over 2,236 records is fast, but doing
// it per keystroke would not be.
const fuse = new Fuse(indexedProducts, fuseOptions);

/** Every product is searchable (decision D12); nothing is filtered out. */
export const indexedCount = indexedProducts.length;

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export interface SearchOutcome {
  /** What the user typed, normalised. */
  query: string;
  /** What was actually searched, after alias rewriting. */
  effectiveQuery: string;
  results: Product[];
  /** True when the query was too short to run. (EDGE_CASES B3, B5) */
  tooShort: boolean;
  /** True when the query ran and matched nothing. (EDGE_CASES B1a) */
  empty: boolean;
  /** True when results were cut off by SEARCH_MAX_RESULTS. (EDGE_CASES B7) */
  capped: boolean;
}

export function search(rawQuery: string): SearchOutcome {
  const query = normalise(rawQuery);

  if (query.length < MIN_QUERY_LENGTH) {
    return {
      query,
      effectiveQuery: query,
      results: [],
      tooShort: true,
      empty: false,
      capped: false,
    };
  }

  const effectiveQuery = rewriteQuery(query);
  const matches = fuse.search(effectiveQuery);

  // Drop the long tail. Fuse orders by score but returns everything under the
  // per-key threshold, and that tail is noise: `maggi` matched 146 products, of
  // which three were MAGGI, and `iphone` matched 108, none of which was a phone.
  //
  // The cutoff is absolute rather than relative to the best hit. A relative band
  // cannot reject a query the catalogue simply cannot answer, because when every
  // match is bad the best one is bad too and the whole tail sits within the band.
  const relevant = matches.filter(
    (match) => (match.score ?? 0) <= SEARCH_MAX_SCORE
  );

  // Map back to the plain catalogue record so the denormalised tileLabel does
  // not leak into components, which should ask catalogue.ts for labels.
  const results = relevant
    .slice(0, SEARCH_MAX_RESULTS)
    .map(({ item }) => getProduct(item.id))
    .filter((product): product is Product => product !== undefined);

  return {
    query,
    effectiveQuery,
    results,
    tooShort: false,
    empty: results.length === 0,
    capped: relevant.length > SEARCH_MAX_RESULTS,
  };
}
