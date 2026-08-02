/**
 * Phase 2 test — src/lib/search.ts and src/lib/catalogue.ts.
 *
 * Covers the two things that break quietly: alias rewriting damaging words that
 * merely contain an alias key, and coverage gaps where a shopper's word finds
 * nothing despite the tile being full of the thing they asked for.
 *
 * Run:  node phases/phase-2-catalogue-search/verify_search.ts
 */

import {
  getProduct,
  getProducts,
  getProductsByTile,
  getSections,
  getTile,
  products,
  tiles,
} from "../../src/lib/catalogue.ts";
import { indexedCount, rewriteQuery, search } from "../../src/lib/search.ts";
import aliasJson from "../../data/search-aliases.json" with { type: "json" };

const aliasMap = aliasJson as Record<string, string>;

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

// ---------------------------------------------------------------------------
console.log("\n-- catalogue -----------------------------------------------------");

check("catalogue loads", products.length === 2236, `${products.length} products`);
check("tiles load", tiles.length === 27, `${tiles.length} tiles`);
check(
  "every product is searchable after decision D12",
  products.every((p) => p.isSearchable),
  `${products.filter((p) => p.isSearchable).length}/${products.length}`
);
check("getProduct resolves a known id", getProduct("p_00001") !== undefined);
check("getProduct returns undefined for an unknown id", getProduct("p_99999") === undefined);
check(
  "getProducts drops unknown ids rather than throwing",
  getProducts(["p_00001", "p_99999", "p_00002"]).length === 2
);
check(
  "getProductsByTile is in bestseller order",
  getProductsByTile("pet-store").every(
    (p, i, arr) => i === 0 || arr[i - 1].bestsellerRank <= p.bestsellerRank
  )
);
check("getTile resolves", getTile("pet-store")?.label === "Pet Store");
check(
  "sections group every tile exactly once",
  getSections().reduce((n, s) => n + s.tiles.length, 0) === tiles.length,
  getSections().map((s) => `${s.name}:${s.tiles.length}`).join(", ")
);
check(
  "every tile has at least one product",
  tiles.every((t) => getProductsByTile(t.id).length > 0)
);
check("search index covers the whole catalogue", indexedCount === products.length);

// ---------------------------------------------------------------------------
console.log("\n-- alias rewriting (EDGE_CASES B2) -------------------------------");

const rewrites: [string, string][] = [
  ["maida", "flour"],
  ["MAIDA", "flour"],
  ["  maida  ", "flour"],
  ["cold drink", "juice"],
  ["anda", "egg"],
  ["chai", "tea"],
];
for (const [input, expected] of rewrites) {
  check(`"${input}" rewrites`, rewriteQuery(input) === expected, `-> "${rewriteQuery(input)}"`);
}

// The trap: keys that are substrings of real words must not fire. A naive
// String.replace turns dalchini into "dal pulses lentilchini".
const untouched = ["dalchini", "andaman", "telangana", "chaiwala", "namakeen", "attachment"];
for (const word of untouched) {
  check(
    `"${word}" is left alone`,
    rewriteQuery(word) === word,
    `-> "${rewriteQuery(word)}"`
  );
}

check(
  "an alias inside a phrase rewrites only that word",
  rewriteQuery("maida roti") === "flour roti",
  `-> "${rewriteQuery("maida roti")}"`
);
// Alias values are single words on purpose. Fuse matches the query as ONE
// fuzzy pattern, so expanding "dal" to "dal pulses lentil" produced a
// 17-character phrase resembling no product name and returned zero results.
check(
  "every alias value is a single word",
  Object.values(aliasMap).every((value) => !value.includes(" ")),
  Object.entries(aliasMap)
    .filter(([, v]) => v.includes(" "))
    .map(([k, v]) => `${k}->${v}`)
    .join(", ") || "all single-word"
);
check(
  "every alias resolves to at least one product",
  Object.keys(aliasMap).every((key) => search(key).results.length > 0),
  Object.keys(aliasMap)
    .filter((key) => search(key).results.length === 0)
    .join(", ") || "no dead aliases"
);
check(
  "a multi-word alias beats its component words",
  rewriteQuery("cold drink bottle") === "juice bottle",
  `-> "${rewriteQuery("cold drink bottle")}"`
);

// ---------------------------------------------------------------------------
console.log("\n-- query behaviour -----------------------------------------------");

check("empty query is flagged too short", search("").tooShort);
check("whitespace-only query is flagged too short", search("   ").tooShort);
check("single character is flagged too short", search("a").tooShort);
check("a too-short query returns no results", search("a").results.length === 0);
check(
  "results are capped at 40",
  search("oil").results.length <= 40,
  `${search("oil").results.length}`
);
check(
  "a nonsense query reports empty rather than throwing",
  search("zzzqqqxyw").empty
);

// ---------------------------------------------------------------------------
console.log("\n-- coverage (EDGE_CASES B4) --------------------------------------");
console.log("   an evaluator will type these; each must return something\n");

const mustFind = [
  "maggi", "colgate", "colgat", "pedigree", "amul", "britannia", "tata",
  "nescafe", "dettol", "surf", "harpic", "lizol", "tropicana", "haldiram",
  "milk", "bread", "eggs", "rice", "atta", "dal", "oil", "sugar", "salt",
  "tea", "coffee", "biscuit", "chips", "chocolate", "ice cream", "juice",
  "shampoo", "soap", "toothpaste", "detergent", "diaper", "moisturizer",
  "dog food", "cat food", "noodles", "pasta", "curd", "paneer", "butter",
  "cheese", "honey", "jam", "ketchup", "pickle", "masala", "ghee",
  "almond", "cashew", "raisin", "oats", "cornflakes", "face wash",
  "sanitary pad", "razor", "notebook", "pen",
  "battery", "bulb", "mosquito", "floor cleaner", "dishwash", "garbage bag",
];

const misses: string[] = [];
for (const term of mustFind) {
  const outcome = search(term);
  if (outcome.results.length === 0) misses.push(term);
}
check(
  `all ${mustFind.length} common queries return results`,
  misses.length === 0,
  misses.length ? `MISSING: ${misses.join(", ")}` : "no gaps"
);

// ---------------------------------------------------------------------------
console.log("\n-- things we do not stock (EDGE_CASES B1a) -----------------------");
console.log("   an evaluator probing coverage must get 'Not available here',");
console.log("   not forty rows of honey and hair conditioner\n");

const mustNotFind = [
  "iphone", "laptop", "headphones", "furniture", "mattress", "tshirt",
  "petrol", "cigarettes", "sanitizer", "lipstick", "sofa", "bicycle",
];

const falsePositives = mustNotFind.filter((term) => search(term).results.length > 0);
check(
  `all ${mustNotFind.length} out-of-catalogue queries return nothing`,
  falsePositives.length === 0,
  falsePositives.length
    ? `LEAKED: ${falsePositives
        .map((t) => `${t}(${search(t).results.length})`)
        .join(", ")}`
    : "clean"
);

// The counterweight: the cutoff must not reject things we genuinely stock.
// Both of these are real products and score well below the threshold.
for (const term of ["condoms", "beer"]) {
  check(
    `"${term}" is stocked and still found`,
    search(term).results.length > 0,
    `${search(term).results.length} results`
  );
}

console.log("\n   sample of what a few return:");
for (const term of ["maggi", "colgat", "pedigree", "shampoo", "dog food"]) {
  const outcome = search(term);
  const first = outcome.results[0];
  console.log(
    `     ${term.padEnd(11)} ${String(outcome.results.length).padStart(3)} results` +
      (first ? `  |  ${first.brand} — ${first.name.slice(0, 42)}` : "")
  );
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
