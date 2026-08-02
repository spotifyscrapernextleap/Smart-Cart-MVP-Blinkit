/**
 * Phase 7 test — Browse & Replace.
 *
 * The sheet is a second surface onto the same candidates the panel drew from,
 * and the danger of a second surface is that it becomes a way around the rules
 * the first one enforces. So the checks here are in two halves: the mechanics
 * of the swap, and then — against the real catalogue and the real persona — the
 * assertion that every non-negotiable from spec §1 still holds *after* a
 * replacement, on every row of every panel.
 *
 * Run:  node phases/phase-7-browse-replace/verify_replace.ts
 */

import { getProduct } from "../../src/lib/catalogue.ts";
import { getClassification } from "../../src/lib/recommend/dormancy.ts";
import { buildFallbackPanel, PANEL_ROW_COUNT } from "../../src/lib/recommend/fallback.ts";
import {
  alternativesFor,
  applyReplacement,
  canBrowse,
} from "../../src/lib/recommend/replace.ts";
import { buildShortlists } from "../../src/lib/recommend/shortlist.ts";
import { NEVER_BOUGHT_REASON } from "../../src/lib/recommend/templates.ts";
import type { CartLine, PanelRow } from "../../src/lib/types";

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

const SNACK_CART = cartOf(["p_01163", 2], ["p_01398", 1]);

const panelFor = (cart: CartLine[]) => buildFallbackPanel(buildShortlists(cart), "sig");

// ---------------------------------------------------------------------------
console.log("\n-- what the sheet offers (spec 7.1, EDGE_CASES F6) --------------------");
{
  const panel = panelFor(SNACK_CART);
  const row = panel.rows[0];
  const shortlist = panel.shortlists[row.tile];

  const all = alternativesFor(shortlist, row.productId, []);

  check(
    "the displayed product is never offered as its own replacement",
    !all.some((p) => p.id === row.productId),
    row.productId
  );

  check(
    "everything else in the shortlist is offered",
    all.length === shortlist.length - 1,
    `${all.length} of ${shortlist.length}`
  );

  check(
    "shortlist order is preserved",
    all.map((p) => p.id).join(",") ===
      shortlist.filter((id) => id !== row.productId).join(",")
  );

  check(
    "every alternative comes from the row's own tile",
    all.every((p) => p.tile === row.tile),
    row.tile
  );

  // The panel is computed once at mount, so by the time the sheet opens the
  // cart can hold products the shortlist was built without. (EDGE_CASES F6)
  const inCart = [shortlist[1], shortlist[3]];
  const filtered = alternativesFor(shortlist, row.productId, inCart);

  check(
    "products added to the cart since the panel was built are excluded",
    !filtered.some((p) => inCart.includes(p.id)) &&
      filtered.length === all.length - inCart.length,
    `${filtered.length} left`
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- a shortlist that has outlived its catalogue (EDGE_CASES C2) --------");
{
  const panel = panelFor(SNACK_CART);
  const row = panel.rows[0];
  const shortlist = panel.shortlists[row.tile];

  // Product ids are positional. A panel cached before a catalogue rebuild can
  // name products that no longer exist, and the sheet reads straight from it.
  const poisoned = [...shortlist, "p_99999", "not-an-id"];
  const alternatives = alternativesFor(poisoned, row.productId, []);

  check(
    "unknown ids are dropped rather than rendered",
    alternatives.every((p) => getProduct(p.id) !== undefined) &&
      alternatives.length === shortlist.length - 1
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- a missing or empty shortlist ---------------------------------------");
{
  check("undefined yields no alternatives", alternativesFor(undefined, "p_00001", []).length === 0);
  check("an empty list yields no alternatives", alternativesFor([], "p_00001", []).length === 0);
  check(
    "a non-array is tolerated",
    alternativesFor("nonsense" as unknown as string[], "p_00001", []).length === 0
  );
  check("canBrowse is false for all of them", !canBrowse(undefined, "p_00001", []));
}

// ---------------------------------------------------------------------------
console.log("\n-- the control is disabled rather than opening empty (F5) -------------");
{
  const panel = panelFor(SNACK_CART);
  const row = panel.rows[0];
  const shortlist = panel.shortlists[row.tile];

  check(
    "with alternatives available, the control is enabled",
    canBrowse(shortlist, row.productId, [])
  );

  // Everything except the displayed product is in the cart, so the sheet would
  // have nothing to show. D7 makes this reachable for real: at a ₹100 ceiling
  // bath-body has only four products under the cap.
  const everythingElse = shortlist.filter((id) => id !== row.productId);
  check(
    "with the rest of the shortlist in the cart, the control is disabled",
    !canBrowse(shortlist, row.productId, everythingElse),
    `${everythingElse.length} products in cart`
  );

  check(
    "a shortlist holding only the displayed product disables it",
    !canBrowse([row.productId], row.productId, [])
  );

  check(
    "one remaining alternative still opens the sheet",
    canBrowse(shortlist, row.productId, everythingElse.slice(1))
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- the swap preserves what identifies the row (spec 7.2) --------------");
{
  const panel = panelFor(SNACK_CART);

  for (const row of panel.rows) {
    const replacement = panel.shortlists[row.tile].find((id) => id !== row.productId)!;
    const swapped = applyReplacement(row, replacement);

    check(
      `[${row.slot}${row.position}] slot is preserved`,
      swapped.slot === row.slot,
      swapped.slot
    );
    check(
      `[${row.slot}${row.position}] position is preserved`,
      swapped.position === row.position,
      String(swapped.position)
    );
    check(`[${row.slot}${row.position}] tile is preserved`, swapped.tile === row.tile);
    check(
      `[${row.slot}${row.position}] the product changed`,
      swapped.productId === replacement && swapped.productId !== row.productId
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- a reason line survives only if it is about the TILE ----------------");
{
  const panel = panelFor(SNACK_CART);
  const aRow = panel.rows.find((r) => r.slot === "A")!;
  const bRow = panel.rows.find((r) => r.slot === "B")!;

  const aSwapped = applyReplacement(aRow, panel.shortlists[aRow.tile][1]);
  const bSwapped = applyReplacement(bRow, panel.shortlists[bRow.tile][1]);

  // Slot A lines are structurally category claims — the template builds them
  // from the tile label, and a model line is rejected unless it contains it
  // (E10). The tile does not change, so the claim stays true.
  check(
    "a dormant line survives the swap",
    aSwapped.reason === aRow.reason,
    aSwapped.reason
  );

  // Slot B lines carry no such guarantee: the model is asked for inference, and
  // inference can be about the specific product.
  check(
    "a never-bought line does not survive the swap",
    bSwapped.reason === NEVER_BOUGHT_REASON,
    bSwapped.reason
  );

  const productSpecific: PanelRow = { ...bRow, reason: "Handy for weekend baking" };
  check(
    "a product-specific never-bought line is discarded",
    applyReplacement(productSpecific, panel.shortlists[bRow.tile][1]).reason ===
      NEVER_BOUGHT_REASON
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- the sheet is not a way around the panel's rules (spec §1) ----------");
console.log("   every alternative, on every row, of several carts\n");
{
  const carts: [string, CartLine[]][] = [
    ["empty cart", []],
    ["snacks + soap", SNACK_CART],
    ["dog food", cartOf(["p_02161", 1])],
    ["large cart", cartOf(["p_01163", 2], ["p_00479", 3], ["p_02100", 1])],
  ];

  const { ownedProductIds } = getClassification();

  for (const [label, cart] of carts) {
    const set = buildShortlists(cart);
    const panel = buildFallbackPanel(set, "sig");
    const cartIds = cart.map((l) => l.productId);
    const cartTiles = new Set(
      cart.map((l) => getProduct(l.productId)?.tile).filter(Boolean) as string[]
    );

    const everyAlternative = panel.rows.flatMap((row) =>
      alternativesFor(panel.shortlists[row.tile], row.productId, cartIds).map((p) => ({
        row,
        product: p,
      }))
    );

    check(
      `[${label}] every row can be browsed or is explicitly empty`,
      panel.rows.every((row) => {
        const n = alternativesFor(panel.shortlists[row.tile], row.productId, cartIds).length;
        return n > 0 || !canBrowse(panel.shortlists[row.tile], row.productId, cartIds);
      }),
      `${everyAlternative.length} alternatives across ${PANEL_ROW_COUNT} rows`
    );

    check(
      `[${label}] no alternative is already in the cart (D1)`,
      !everyAlternative.some(({ product }) => cartIds.includes(product.id))
    );

    check(
      `[${label}] no alternative comes from a tile in the cart (D1a)`,
      !everyAlternative.some(({ product }) => cartTiles.has(product.tile))
    );

    check(
      `[${label}] no slot-B alternative exceeds the price ceiling (D4)`,
      everyAlternative
        .filter(({ row }) => row.slot === "B")
        .every(({ product }) => product.price <= set.priceCeiling),
      `ceiling ₹${set.priceCeiling}`
    );

    check(
      `[${label}] no slot-A alternative is an owned durable (D3)`,
      everyAlternative
        .filter(({ row }) => row.slot === "A")
        .every(({ product }) => !(ownedProductIds.has(product.id) && !product.isConsumable))
    );

    // Replacing every row at once is the worst case for tile diversity.
    const replaced = panel.rows.map((row) => {
      const next = alternativesFor(panel.shortlists[row.tile], row.productId, cartIds)[0];
      return next ? applyReplacement(row, next.id) : row;
    });

    check(
      `[${label}] replacing every row keeps four rows from four tiles (D5)`,
      replaced.length === PANEL_ROW_COUNT &&
        new Set(replaced.map((r) => r.tile)).size === PANEL_ROW_COUNT
    );

    check(
      `[${label}] replacing every row keeps slots A, A, B, B`,
      replaced.map((r) => r.slot).join("") === "AABB"
    );

    check(
      `[${label}] positions stay 1..${PANEL_ROW_COUNT} in order`,
      replaced.every((r, i) => r.position === i + 1)
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- the owned Padded Harness stays out of the sheet --------------------");
{
  // p_02159 is the persona's own durable in pet-store. It is excluded from the
  // dormant shortlist, so it cannot reach the sheet either — the sheet reads
  // the shortlist, which is the point of building the exclusions there.
  const panel = panelFor([]);
  const petRow = panel.rows.find((r) => r.tile === "pet-store");

  check("pet-store is on the panel for an empty cart", petRow !== undefined);
  if (petRow) {
    const alternatives = alternativesFor(panel.shortlists["pet-store"], petRow.productId, []);
    check(
      "the harness is offered nowhere in the sheet",
      !alternatives.some((p) => p.id === "p_02159"),
      `${alternatives.length} alternatives checked`
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- swapping back, and repeated swaps ----------------------------------");
{
  const panel = panelFor(SNACK_CART);
  const row = panel.rows[0];
  const shortlist = panel.shortlists[row.tile];

  const once = applyReplacement(row, shortlist[1]);
  const twice = applyReplacement(once, shortlist[2]);

  check("a second replacement works from the first", twice.productId === shortlist[2]);
  check("slot and position survive both", twice.slot === row.slot && twice.position === row.position);

  // The product that was displaced is a legitimate candidate again — it is in
  // the shortlist and not in the cart — so the user can go back.
  check(
    "the displaced product becomes selectable again",
    alternativesFor(shortlist, once.productId, []).some((p) => p.id === row.productId)
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- determinism -------------------------------------------------------");
{
  const panel = panelFor(SNACK_CART);
  const row = panel.rows[0];
  const a = alternativesFor(panel.shortlists[row.tile], row.productId, []);
  const b = alternativesFor(panel.shortlists[row.tile], row.productId, []);
  check(
    "the same inputs produce the same list",
    JSON.stringify(a.map((p) => p.id)) === JSON.stringify(b.map((p) => p.id))
  );
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
