/**
 * Phase 4 test — the deterministic recommendation path.
 *
 * Asserts every rule the build spec calls non-negotiable (§1), against the real
 * catalogue and the real persona history. These are enforced by code rather than
 * by the model, so they must hold before a model is ever involved.
 *
 * Run:  node phases/phase-4-recommend/verify_recommend.ts
 */

import { getProduct, getProductsByTile, getTile } from "../../src/lib/catalogue.ts";
import {
  DORMANT_TILES_OFFERED,
  NEVERBOUGHT_TILES_OFFERED,
  PRICE_CEILING_FLOOR,
  PRICE_CEILING_RATIO,
  SHORTLIST_SIZE,
} from "../../src/lib/config.ts";
import { getClassification, getTilesByClass } from "../../src/lib/recommend/dormancy.ts";
import { buildFallbackPanel, PANEL_ROW_COUNT } from "../../src/lib/recommend/fallback.ts";
import {
  buildShortlists,
  computePriceCeiling,
  computeSubtotal,
} from "../../src/lib/recommend/shortlist.ts";
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

/**
 * Does a reason line assert that the user has bought this before?
 *
 * Deliberately NOT a blanket ban on "you". The spec's own canonical
 * never-bought line is "Popular with households near you" — a locality claim,
 * not a history claim — so a naive /\byou\b/ test rejects the correct answer.
 * What must never appear is a claim of *prior purchase*, since none exists for
 * a category the persona has never bought from.
 *
 * Phase 6 reuses this shape to validate model-written lines. (EDGE_CASES E2)
 */
const CLAIMS_HISTORY =
  /\byou(?:'ve| have)?\s+(?:ordered|bought|purchased|tried|last|used|loved)\b|\byour\s+(?:order|purchase|usual|last)\b|\bagain\b|\bused to\b|\blast time\b|\bre-?order\b|\brestock\b/i;

/** Every non-negotiable from spec §1, applied to one panel. */
function assertPanelInvariants(label: string, cart: CartLine[]) {
  const set = buildShortlists(cart);
  const panel = buildFallbackPanel(set, "sig");
  const { ownedProductIds } = getClassification();
  const cartProductIds = new Set(cart.map((l) => l.productId));
  const cartTiles = new Set(
    cart.map((l) => getProduct(l.productId)?.tile).filter(Boolean) as string[]
  );

  check(`[${label}] renders exactly ${PANEL_ROW_COUNT} rows`, panel.rows.length === PANEL_ROW_COUNT, `${panel.rows.length}`);

  const tilesUsed = panel.rows.map((r) => r.tile);
  check(
    `[${label}] all four rows come from four different tiles`,
    new Set(tilesUsed).size === panel.rows.length,
    tilesUsed.join(", ")
  );

  check(
    `[${label}] positions are 1..${PANEL_ROW_COUNT} in order`,
    panel.rows.every((r, i) => r.position === i + 1)
  );

  check(
    `[${label}] every row resolves to a real product`,
    panel.rows.every((r) => getProduct(r.productId) !== undefined)
  );

  check(
    `[${label}] every row's product actually belongs to its stated tile`,
    panel.rows.every((r) => getProduct(r.productId)?.tile === r.tile)
  );

  check(
    `[${label}] no recommended product is already in the cart (D1)`,
    panel.rows.every((r) => !cartProductIds.has(r.productId))
  );

  check(
    `[${label}] no recommended tile is already in the cart (D1a)`,
    panel.rows.every((r) => !cartTiles.has(r.tile)),
    `cart tiles: ${[...cartTiles].join(", ") || "none"}`
  );

  const ceiling = computePriceCeiling(computeSubtotal(cart));
  const bRows = panel.rows.filter((r) => r.slot === "B");
  check(
    `[${label}] every slot-B product is at or below the price ceiling`,
    bRows.every((r) => (getProduct(r.productId)?.price ?? 0) <= ceiling),
    `ceiling ₹${Math.round(ceiling)}, B prices ${bRows.map((r) => getProduct(r.productId)!.price).join(", ") || "none"}`
  );

  const aRows = panel.rows.filter((r) => r.slot === "A");
  check(
    `[${label}] no slot-A product is a durable the persona already owns`,
    aRows.every((r) => {
      const p = getProduct(r.productId)!;
      return !(ownedProductIds.has(p.id) && !p.isConsumable);
    })
  );

  check(
    `[${label}] every reason line is non-empty and ≤100 chars`,
    panel.rows.every((r) => r.reason.length > 0 && r.reason.length <= 100)
  );

  check(
    `[${label}] slot-B reason lines claim no purchase history`,
    bRows.every((r) => !CLAIMS_HISTORY.test(r.reason)),
    bRows.map((r) => r.reason).join(" | ")
  );

  check(
    `[${label}] shortlists are returned for exactly the four chosen tiles`,
    Object.keys(panel.shortlists).length === new Set(tilesUsed).size &&
      tilesUsed.every((t) => Array.isArray(panel.shortlists[t]))
  );

  check(
    `[${label}] each row's product is the top entry of its own shortlist`,
    panel.rows.every((r) => panel.shortlists[r.tile]?.[0] === r.productId)
  );

  return panel;
}

// ---------------------------------------------------------------------------
console.log("\n-- the history-claim detector itself (EDGE_CASES E2) -----------------");
console.log("   a permissive regex that passes everything proves nothing\n");
{
  // Lines a model might plausibly write about a never-bought category. Each is
  // false for a category the persona has never purchased from.
  const mustReject = [
    "You ordered this 3 weeks ago",
    "You bought this last month",
    "You have tried this before",
    "Back in stock — order again",
    "Your usual pick from this aisle",
    "You used to order this weekly",
    "Time to restock this",
    "Reorder your last purchase",
    "You loved this last time",
  ];
  const leaked = mustReject.filter((line) => !CLAIMS_HISTORY.test(line));
  check(
    `all ${mustReject.length} history-claiming lines are rejected`,
    leaked.length === 0,
    leaked.join(" | ") || "none leak"
  );

  // Legitimate never-bought lines, including the spec's own example, which
  // contains the word "you" as a locality reference rather than a history claim.
  const mustAccept = [
    "Popular with households near you",
    "Most households ordering weekly staples keep this",
    "A favourite in your neighbourhood",
    "Widely bought in Indiranagar",
  ];
  const wronglyRejected = mustAccept.filter((line) => CLAIMS_HISTORY.test(line));
  check(
    `all ${mustAccept.length} legitimate inference lines are accepted`,
    wronglyRejected.length === 0,
    wronglyRejected.join(" | ") || "none rejected"
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- classification -------------------------------------------------");
{
  const { statsByTile, ownedProductIds, isEligible } = getClassification();
  const active = getTilesByClass("active");
  const dormant = getTilesByClass("dormant");
  const never = getTilesByClass("never-bought");

  check("persona clears the tenure gate", isEligible);
  check("6 active tiles", active.length === 6, active.map((t) => t.tile).join(", "));
  check("4 dormant tiles", dormant.length === 4, dormant.map((t) => `${t.tile}:${t.mostRecentDaysAgo}d`).join(", "));
  check("17 never-bought tiles", never.length === 17, `${never.length}`);
  check(
    "every classified tile is accounted for exactly once",
    active.length + dormant.length + never.length === statsByTile.size
  );
  check(
    "dormant tiles are all at or beyond the dormancy threshold",
    dormant.every((t) => (t.mostRecentDaysAgo ?? 0) >= 30)
  );
  check(
    "active tiles are all inside the dormancy threshold",
    active.every((t) => (t.mostRecentDaysAgo ?? 999) < 30)
  );
  check("ownedProductIds is populated", ownedProductIds.size > 0, `${ownedProductIds.size} products`);
  check(
    "the owned durable p_02159 is in ownedProductIds",
    ownedProductIds.has("p_02159")
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- price ceiling ---------------------------------------------------");
{
  check(
    `an empty cart falls back to the ₹${PRICE_CEILING_FLOOR} floor`,
    computePriceCeiling(0) === PRICE_CEILING_FLOOR
  );
  check(
    "a small cart still uses the floor",
    computePriceCeiling(100) === PRICE_CEILING_FLOOR,
    `subtotal ₹100 → ₹${computePriceCeiling(100)}`
  );
  check(
    "a large cart uses the ratio",
    computePriceCeiling(1000) === 1000 * PRICE_CEILING_RATIO,
    `subtotal ₹1000 → ₹${computePriceCeiling(1000)}`
  );
  check("there is no upper cap", computePriceCeiling(100000) === 50000);
}

// ---------------------------------------------------------------------------
console.log("\n-- shortlist construction ------------------------------------------");
{
  const set = buildShortlists(cartOf(["p_01163", 1]));
  check(
    `at most ${DORMANT_TILES_OFFERED} dormant shortlists are offered`,
    set.dormant.length <= DORMANT_TILES_OFFERED,
    `${set.dormant.length}`
  );
  check(
    `at most ${NEVERBOUGHT_TILES_OFFERED} never-bought shortlists are offered`,
    set.neverBought.length <= NEVERBOUGHT_TILES_OFFERED,
    `${set.neverBought.length}`
  );
  check(
    `no shortlist exceeds SHORTLIST_SIZE (${SHORTLIST_SIZE})`,
    [...set.dormant, ...set.neverBought].every((s) => s.products.length <= SHORTLIST_SIZE)
  );
  check(
    "no shortlist is empty",
    [...set.dormant, ...set.neverBought].every((s) => s.products.length > 0)
  );
  check(
    "dormant shortlists are ordered most-recently-lapsed first",
    set.dormant.every(
      (s, i, arr) => i === 0 || (arr[i - 1].mostRecentDaysAgo ?? 0) <= (s.mostRecentDaysAgo ?? 0)
    ),
    set.dormant.map((s) => `${s.tile}:${s.mostRecentDaysAgo}d`).join(", ")
  );
  check(
    "products within a shortlist are in bestseller order",
    [...set.dormant, ...set.neverBought].every((s) =>
      s.products.every((p, i, arr) => i === 0 || arr[i - 1].bestsellerRank <= p.bestsellerRank)
    )
  );

  const { ordersBySection } = getClassification();
  const sections = set.neverBought.map((s) => getTile(s.tile)!.section);
  console.log(
    "\n   never-bought tiles offered (D6 ordering):\n" +
      set.neverBought
        .map(
          (s) =>
            `     ${s.tile.padEnd(24)} ${getTile(s.tile)!.section.padEnd(24)} section orders: ${ordersBySection.get(getTile(s.tile)!.section)}`
        )
        .join("\n")
  );
  check(
    "never-bought tiles come from the persona's least-explored sections",
    sections.every(
      (s) => (ordersBySection.get(s) ?? 0) <= 5,
      "Beauty & Personal Care has 0, Household 5, vs Grocery 97"
    ),
    sections.join(", ")
  );
  check(
    "no more than 2 offered never-bought tiles share a section",
    Object.values(
      sections.reduce<Record<string, number>>((acc, s) => {
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {})
    ).every((n) => n <= 2)
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- panel invariants across a range of carts -------------------------");

// An ordinary two-tile cart.
console.log("");
const basePanel = assertPanelInvariants("noodles+soap", cartOf(["p_01163", 1], ["p_01398", 1]));

// The spec requires the panel to render with no minimum cart size.
console.log("");
assertPanelInvariants("empty cart", []);

// A large cart, to push the ceiling well above the floor.
console.log("");
assertPanelInvariants("expensive cart", cartOf(["p_02160", 2], ["p_01398", 3]));

// ---------------------------------------------------------------------------
console.log("\n-- slot allocation ---------------------------------------------------");
{
  const slots = basePanel.rows.map((r) => r.slot);
  check(
    "an unconstrained cart yields exactly the 2+2 split",
    slots.filter((s) => s === "A").length === 2 && slots.filter((s) => s === "B").length === 2,
    slots.join(", ")
  );
  check("rows are ordered A, A, B, B", slots.join("") === "AABB", slots.join(""));
}

// ---------------------------------------------------------------------------
console.log("\n-- the ceiling actually moves the slot-B products --------------------");
{
  // Spec test: "Vary the cart subtotal and confirm the B products change accordingly."
  const cheap = buildFallbackPanel(buildShortlists(cartOf(["p_01197", 1])), "s");
  const rich = buildFallbackPanel(buildShortlists(cartOf(["p_02160", 3])), "s");

  const cheapCeiling = computePriceCeiling(computeSubtotal(cartOf(["p_01197", 1])));
  const richCeiling = computePriceCeiling(computeSubtotal(cartOf(["p_02160", 3])));

  const cheapB = cheap.rows.filter((r) => r.slot === "B").map((r) => getProduct(r.productId)!);
  const richB = rich.rows.filter((r) => r.slot === "B").map((r) => getProduct(r.productId)!);

  console.log(
    `\n   ₹${Math.round(cheapCeiling)} ceiling → ${cheapB.map((p) => `${p.name.slice(0, 26)} ₹${p.price}`).join(" | ")}`
  );
  console.log(
    `   ₹${Math.round(richCeiling)} ceiling → ${richB.map((p) => `${p.name.slice(0, 26)} ₹${p.price}`).join(" | ")}\n`
  );

  check("a bigger cart raises the ceiling", richCeiling > cheapCeiling);
  check(
    "both panels respect their own ceiling",
    cheapB.every((p) => p.price <= cheapCeiling) && richB.every((p) => p.price <= richCeiling)
  );
  check(
    "the richer cart's slot-B products differ from the cheaper cart's",
    richB.map((p) => p.id).join() !== cheapB.map((p) => p.id).join()
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- the durable-exclusion rule is observable ---------------------------");
{
  // p_02159 is the Padded Harness: non-consumable, owned by the persona, and
  // ranked 6th in pet-store — high enough that its absence from a 12-item
  // shortlist is visible rather than incidental.
  const harness = getProduct("p_02159")!;
  check(
    "the owned durable ranks inside SHORTLIST_SIZE for its tile",
    harness.bestsellerRank <= SHORTLIST_SIZE,
    `rank ${harness.bestsellerRank} of ${getProductsByTile("pet-store").length}`
  );

  const set = buildShortlists([]);
  const petStore = [...set.dormant, ...set.neverBought].find((s) => s.tile === "pet-store");
  check("pet-store is offered as a dormant shortlist", petStore !== undefined);
  if (petStore) {
    check(
      "the owned durable is excluded from it",
      !petStore.products.some((p) => p.id === "p_02159"),
      `shortlist: ${petStore.products.slice(0, 4).map((p) => `${p.id}(r${p.bestsellerRank})`).join(", ")}…`
    );
    check(
      "an owned CONSUMABLE from the same tile is NOT excluded",
      // p_02161 is dog food: owned, consumable, and a lapsed staple we want back.
      getProduct("p_02161")!.isConsumable &&
        getProductsByTile("pet-store").some((p) => p.id === "p_02161")
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- D1a: carting from a dormant tile moves the panel on ----------------");
{
  // The evaluator gesture from decision D12a: search pedigree, add dog food,
  // open the cart. Recommending more Pet Store would be nonsense.
  const before = buildFallbackPanel(buildShortlists([]), "s");
  const after = buildFallbackPanel(buildShortlists(cartOf(["p_02161", 1])), "s");

  const beforeTiles = before.rows.map((r) => r.tile);
  const afterTiles = after.rows.map((r) => r.tile);

  console.log(`\n   before: ${beforeTiles.join(", ")}`);
  console.log(`   after:  ${afterTiles.join(", ")}\n`);

  check("pet-store is recommended before the dog food is added", beforeTiles.includes("pet-store"));
  check("pet-store is NOT recommended after it is added", !afterTiles.includes("pet-store"));
  check("the panel still renders four rows", after.rows.length === PANEL_ROW_COUNT);
  check(
    "the next dormant tile takes its place",
    after.rows.some((r) => r.slot === "A" && !beforeTiles.includes(r.tile)),
    afterTiles.join(", ")
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- determinism -------------------------------------------------------");
{
  const cart = cartOf(["p_01163", 2], ["p_01398", 1]);
  const a = buildFallbackPanel(buildShortlists(cart), "s");
  const b = buildFallbackPanel(buildShortlists(cart), "s");
  check(
    "the same cart produces byte-identical panels",
    JSON.stringify(a) === JSON.stringify(b)
  );
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
