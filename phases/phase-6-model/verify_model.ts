/**
 * Phase 6 test — the model layer, with no model.
 *
 * Every check here drives the real validation code with a hand-written model
 * response, so the failures the network would only produce occasionally can be
 * produced on demand: a hallucinated id, two picks from one tile, a line that
 * claims a purchase that never happened, markdown fences, a reasoning block,
 * outright garbage.
 *
 * The point of the phase is that none of these reach the screen. The panel that
 * comes out the other side still satisfies every non-negotiable from spec §1 —
 * four rows, four tiles, A A B B, the price ceiling, no owned durable, no cart
 * product and no cart tile — because the model was only ever allowed to choose
 * among candidates that already satisfied them.
 *
 * Run:  node phases/phase-6-model/verify_model.ts
 */

import { getProduct } from "../../src/lib/catalogue.ts";
import {
  MODEL_SHORTLIST_DEPTH,
  REASON_MAX_CHARS,
  SHORTLIST_SIZE,
} from "../../src/lib/config.ts";
import { getClassification } from "../../src/lib/recommend/dormancy.ts";
import { buildRows, PANEL_ROW_COUNT } from "../../src/lib/recommend/fallback.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "../../src/lib/recommend/prompt.ts";
import { buildShortlists } from "../../src/lib/recommend/shortlist.ts";
import { NEVER_BOUGHT_REASON } from "../../src/lib/recommend/templates.ts";
import {
  CLAIMS_HISTORY,
  extractJson,
  resolveModelPanel,
  sanitiseReason,
} from "../../src/lib/recommend/validate.ts";
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

/** A snacks-and-staples cart — the spec's own Phase 6 test scenario. */
const SNACK_CART = cartOf(["p_01163", 2], ["p_01398", 1]);

/**
 * Runs a raw model response through the real path and returns the rows the
 * panel would render, or null if the response was rejected wholesale.
 */
function panelFrom(cart: CartLine[], raw: string): PanelRow[] | null {
  const set = buildShortlists(cart);
  const resolved = resolveModelPanel(set, raw);
  if (!resolved) return null;

  return buildRows(resolved.shortlists, (shortlist) => {
    const choice = resolved.choices.get(shortlist.tile);
    if (!choice) return undefined;
    return { productId: choice.productId, reason: choice.reason ?? undefined };
  });
}

/** Ids the model is *allowed* to return, by slot type, for a given cart. */
function offered(cart: CartLine[]) {
  const set = buildShortlists(cart);
  return {
    set,
    dormant: set.dormant.map((s) => s.products.map((p) => p.id)),
    neverBought: set.neverBought.map((s) => s.products.map((p) => p.id)),
    /**
     * A dormant line that will survive validation for the nth dormant tile.
     * It has to name that tile — a line that does not is a claim about the
     * product rather than the category, and is rejected. (EDGE_CASES E10)
     */
    line: (index: number) =>
      `You last ordered from ${set.dormant[index].tileLabel} 5 weeks ago`,
  };
}

function responseOf(
  dormant: [string, string][],
  neverBought: [string, string][]
): string {
  return JSON.stringify({
    dormant: dormant.map(([productId, reason]) => ({ productId, reason })),
    neverBought: neverBought.map(([productId, reason]) => ({ productId, reason })),
  });
}

// ---------------------------------------------------------------------------
console.log("\n-- the history-claim detector, against the SHIPPING regex -------------");
console.log("   the Phase 4 suite self-tested its own copy; this is the real one\n");
{
  // Lines a model might plausibly write about a category the persona has never
  // bought from. Every one of them is false.
  const mustReject = [
    "You ordered this 3 weeks ago",
    "You bought this last month",
    "You have tried this before",
    "Your usual pick, back in stock",
    "Time to restock your shelf",
    "Order this again today",
    "You used to buy this often",
    "Last time you loved this",
    "Re-order your favourite dal",
  ];
  for (const line of mustReject) {
    check(`rejects "${line}"`, CLAIMS_HISTORY.test(line));
  }

  // Legitimate never-bought lines. The spec's own canonical example contains
  // the word "you" — a locality claim, not a history claim — so a blanket ban
  // on "you" would fail the correct answer.
  const mustAccept = [
    NEVER_BOUGHT_REASON,
    "Popular with households nearby",
    "Commonly bought with weekly staples",
    "Households your size often add this",
  ];
  for (const line of mustAccept) {
    check(`accepts "${line}"`, !CLAIMS_HISTORY.test(line));
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- reason sanitising (EDGE_CASES E2, E8) ------------------------------");
{
  check(
    "a clean never-bought line passes through",
    sanitiseReason(NEVER_BOUGHT_REASON, "B") === NEVER_BOUGHT_REASON
  );

  check(
    "a history claim on slot B is rejected",
    sanitiseReason("You ordered this last month", "B") === null
  );

  // The same sentence is TRUE on a dormant row — that is the whole point of
  // slot A — so the never-bought detector must not be applied there.
  check(
    "the same claim on slot A is allowed when it names the tile",
    sanitiseReason("You last ordered from Pet Store 7 weeks ago", "A", "Pet Store") ===
      "You last ordered from Pet Store 7 weeks ago"
  );

  // The build spec's own example dormant line. It is a claim about the specific
  // product, and the product on a dormant row is chosen by bestseller rank —
  // usually not one the persona ever bought. (EDGE_CASES E10)
  check(
    'slot A rejects "You used to order this regularly" — a product-level claim',
    sanitiseReason("You used to order this regularly", "A", "Pet Store") === null
  );

  check(
    "slot A rejects a line that names no category at all",
    sanitiseReason("Time to top this up", "A", "Pet Store") === null
  );

  check(
    "slot A tile matching ignores case",
    sanitiseReason("Your pet store order was 7 weeks ago", "A", "Pet Store") !== null
  );

  check(
    "exclamation marks are stripped, not rejected",
    sanitiseReason("Popular with households near you!", "B") === NEVER_BOUGHT_REASON
  );

  check(
    "whitespace is collapsed",
    sanitiseReason("  Popular   with\nhouseholds near you ", "B") === NEVER_BOUGHT_REASON
  );

  check("an empty line is rejected", sanitiseReason("   ", "B") === null);

  check(
    `a line over ${REASON_MAX_CHARS} characters is rejected`,
    sanitiseReason("x".repeat(REASON_MAX_CHARS + 1), "B") === null
  );

  check(
    `a line of exactly ${REASON_MAX_CHARS} characters is kept`,
    sanitiseReason("x".repeat(REASON_MAX_CHARS), "B") !== null
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- extracting JSON from what the model actually returns (E5) ----------");
{
  const body = '{"dormant":[],"neverBought":[]}';

  check("plain JSON is returned unchanged", extractJson(body) === body);

  check(
    "markdown fences are stripped",
    extractJson("```json\n" + body + "\n```") === body
  );

  check("bare fences are stripped", extractJson("```\n" + body + "\n```") === body);

  check(
    "leading prose is discarded",
    extractJson("Sure! Here is the JSON you asked for:\n" + body) === body
  );

  // A reasoning model can emit its thinking inline instead of in the separate
  // field. The thinking contains braces, so it has to go before the object is
  // located, not after.
  check(
    "an inline reasoning block is removed",
    extractJson("<think>the cart has {snacks} so I will pick</think>\n" + body) === body
  );

  check("prose with no object at all returns null", extractJson("I cannot help") === null);
  check("an empty string returns null", extractJson("") === null);
}

// ---------------------------------------------------------------------------
console.log("\n-- a well-formed response is honoured ---------------------------------");
{
  const { dormant, neverBought, line } = offered(SNACK_CART);

  // Pick something that is NOT the top-ranked product in each shortlist, so a
  // panel that silently ignored the model would be visibly identical to the
  // deterministic one and this check would fail.
  const picks: [string, string][] = [
    [dormant[0][3], line(0)],
    [dormant[1][2], line(1)],
  ];
  const bPicks: [string, string][] = [
    [neverBought[0][4], "Popular with households near you"],
    [neverBought[1][1], "Common alongside weekly staples"],
  ];

  const rows = panelFrom(SNACK_CART, responseOf(picks, bPicks));
  check("the response is accepted", rows !== null);

  if (rows) {
    check(`renders exactly ${PANEL_ROW_COUNT} rows`, rows.length === PANEL_ROW_COUNT);
    check(
      "slots are A, A, B, B",
      rows.map((r) => r.slot).join("") === "AABB",
      rows.map((r) => r.slot).join("")
    );
    check(
      "all four rows come from four different tiles",
      new Set(rows.map((r) => r.tile)).size === PANEL_ROW_COUNT
    );
    check(
      "every product the model chose is the product rendered",
      rows.map((r) => r.productId).join(",") ===
        [picks[0][0], picks[1][0], bPicks[0][0], bPicks[1][0]].join(",")
    );
    check(
      "the model's own reason lines are used",
      rows.map((r) => r.reason).join(" | ") ===
        [picks[0][1], picks[1][1], bPicks[0][1], bPicks[1][1]].join(" | ")
    );
    check(
      "none of them is the deterministic top-ranked pick",
      rows.every((row) => {
        const set = buildShortlists(SNACK_CART);
        const all = [...set.dormant, ...set.neverBought];
        const shortlist = all.find((s) => s.tile === row.tile);
        return shortlist?.products[0].id !== row.productId;
      })
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- hallucinated ids degrade, they do not render (E3) ------------------");
{
  const { dormant, neverBought, line } = offered(SNACK_CART);

  const rows = panelFrom(
    SNACK_CART,
    responseOf(
      [
        ["p_99999", line(0)],
        [dormant[1][2], line(1)],
      ],
      [
        [neverBought[0][4], "Popular with households near you"],
        ["not-an-id-at-all", "Popular with households near you"],
      ]
    )
  );

  check("a partly-hallucinated response is still usable", rows !== null);
  if (rows) {
    check(`still renders ${PANEL_ROW_COUNT} rows`, rows.length === PANEL_ROW_COUNT);
    check(
      "no invented id reaches the panel",
      rows.every((r) => getProduct(r.productId) !== undefined),
      rows.map((r) => r.productId).join(", ")
    );
    check(
      "the valid picks survive alongside the replacements",
      rows.some((r) => r.productId === dormant[1][2]) &&
        rows.some((r) => r.productId === neverBought[0][4])
    );
    check("slots are still A, A, B, B", rows.map((r) => r.slot).join("") === "AABB");
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- a hallucinated id does not drag its reason line along --------------");
{
  const { dormant, line } = offered(SNACK_CART);
  const set = buildShortlists(SNACK_CART);

  // The row that replaces a rejected pick must not wear the sentence written
  // about the product that was rejected.
  const rows = panelFrom(
    SNACK_CART,
    responseOf(
      [
        ["p_99999", "A very specific claim about a product not being shown"],
        [dormant[1][2], line(1)],
      ],
      []
    )
  );

  check("the response is accepted", rows !== null);
  if (rows) {
    check(
      "the orphaned reason line appears nowhere",
      rows.every((r) => r.reason !== "A very specific claim about a product not being shown"),
      rows.map((r) => r.reason).join(" | ")
    );
    const replaced = rows.find((r) => r.slot === "A" && r.productId !== dormant[1][2]);
    const shortlist = set.dormant.find((s) => s.tile === replaced?.tile);
    check(
      "the replaced row gets the template line for its own tile",
      replaced !== undefined && replaced.reason.includes(shortlist?.tileLabel ?? " "),
      replaced?.reason
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- two picks from one tile, and cross-slot picks (E4, D5) -------------");
{
  const { dormant, neverBought, line } = offered(SNACK_CART);

  const rows = panelFrom(
    SNACK_CART,
    responseOf(
      // Both from the FIRST dormant shortlist — the same tile twice.
      [
        [dormant[0][0], line(0)],
        [dormant[0][1], line(0)],
      ],
      // A never-bought slot filled with a dormant product: right shape, wrong list.
      [
        [neverBought[0][0], "Popular with households near you"],
        [dormant[2][0], "Popular with households near you"],
      ]
    )
  );

  check("the response is still usable", rows !== null);
  if (rows) {
    check(
      "the duplicate-tile pick is dropped",
      new Set(rows.map((r) => r.tile)).size === PANEL_ROW_COUNT,
      rows.map((r) => r.tile).join(", ")
    );
    check(
      "a dormant product cannot fill a never-bought slot",
      !rows.some((r) => r.slot === "B" && r.productId === dormant[2][0])
    );
    check(
      "every slot-B row is genuinely from a never-bought shortlist",
      rows
        .filter((r) => r.slot === "B")
        .every((r) => neverBought.some((ids) => ids.includes(r.productId)))
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- a false history claim never reaches slot B (E2) --------------------");
{
  const { dormant, neverBought, line } = offered(SNACK_CART);

  const rows = panelFrom(
    SNACK_CART,
    responseOf(
      [
        [dormant[0][0], line(0)],
        [dormant[1][0], line(1)],
      ],
      [
        [neverBought[0][3], "You ordered this last month, time to restock"],
        [neverBought[1][2], "Popular with households near you"],
      ]
    )
  );

  check("the response is accepted", rows !== null);
  if (rows) {
    const bRows = rows.filter((r) => r.slot === "B");
    check(
      "no slot-B line claims a purchase",
      bRows.every((r) => !CLAIMS_HISTORY.test(r.reason)),
      bRows.map((r) => r.reason).join(" | ")
    );
    check(
      "the offending line is replaced by the template",
      bRows.some((r) => r.reason === NEVER_BOUGHT_REASON)
    );
    // The lie was in the sentence, not in the choice. Throwing away the product
    // too would discard the only judgement the model was called for.
    check(
      "the model's product choice survives the rejected line",
      bRows.some((r) => r.productId === neverBought[0][3]),
      bRows.map((r) => r.productId).join(", ")
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- an over-long line is replaced, the pick is kept (E8) ---------------");
{
  const { dormant, neverBought, line } = offered(SNACK_CART);
  const tooLong = "x".repeat(REASON_MAX_CHARS + 1);

  const rows = panelFrom(
    SNACK_CART,
    responseOf(
      [
        [dormant[0][2], tooLong],
        [dormant[1][0], line(1)],
      ],
      [[neverBought[0][0], "Popular with households near you"]]
    )
  );

  check("the response is accepted", rows !== null);
  if (rows) {
    check(
      "no rendered line exceeds the cap",
      rows.every((r) => r.reason.length <= REASON_MAX_CHARS),
      String(Math.max(...rows.map((r) => r.reason.length)))
    );
    check(
      "the pick whose line was too long is still rendered",
      rows.some((r) => r.productId === dormant[0][2])
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- responses that must be rejected wholesale --------------------------");
{
  const cases: [string, string][] = [
    ["not JSON at all", "the model apologises and explains itself"],
    ["truncated JSON", '{"dormant":[{"productId":'],
    ["valid JSON of the wrong shape", '{"picks":["p_00001"]}'],
    ["both arrays empty", '{"dormant":[],"neverBought":[]}'],
    ["every id hallucinated", responseOf([["p_99999", "x"]], [["p_88888", "y"]])],
    ["nulls where objects belong", '{"dormant":[null,null],"neverBought":[null]}'],
    ["ids that are not strings", '{"dormant":[{"productId":42,"reason":"x"}],"neverBought":[]}'],
  ];

  for (const [label, raw] of cases) {
    check(`${label} → whole-response failure`, panelFrom(SNACK_CART, raw) === null);
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- the non-negotiables still hold on a model panel (spec §1) ----------");
{
  const cart = cartOf(["p_02161", 1]); // dog food: cart is IN a dormant tile
  const { dormant, neverBought, set, line } = offered(cart);
  const { ownedProductIds } = getClassification();
  const cartTiles = new Set(
    cart.map((l) => getProduct(l.productId)?.tile).filter(Boolean) as string[]
  );

  const rows = panelFrom(
    cart,
    responseOf(
      [
        [dormant[0][1], line(0)],
        [dormant[1][3], line(1)],
      ],
      [
        [neverBought[0][2], "Popular with households near you"],
        [neverBought[1][5], "Common alongside weekly staples"],
      ]
    )
  );

  check("the response is accepted", rows !== null);
  if (rows) {
    check(
      "nothing in the cart is recommended (D1)",
      !rows.some((r) => r.productId === "p_02161")
    );
    check(
      "no tile in the cart is recommended (D1a)",
      !rows.some((r) => cartTiles.has(r.tile)),
      rows.map((r) => r.tile).join(", ")
    );
    check(
      "no slot-B product exceeds the price ceiling (D4)",
      rows
        .filter((r) => r.slot === "B")
        .every((r) => (getProduct(r.productId)?.price ?? 0) <= set.priceCeiling),
      `ceiling ₹${set.priceCeiling}`
    );
    check(
      "no owned durable appears on a dormant row (D3)",
      rows
        .filter((r) => r.slot === "A")
        .every(
          (r) =>
            !(ownedProductIds.has(r.productId) && !getProduct(r.productId)?.isConsumable)
        )
    );
    check(
      "the owned Padded Harness is absent",
      !rows.some((r) => r.productId === "p_02159")
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- the prompt (spec §4 Step 8) ----------------------------------------");
{
  const set = buildShortlists(SNACK_CART);
  const user = buildUserPrompt(SNACK_CART, set);
  const payload = JSON.parse(user);

  check(
    "every offered shortlist is sent",
    payload.dormant.length === set.dormant.length &&
      payload.neverBought.length === set.neverBought.length,
    `${payload.dormant.length} dormant + ${payload.neverBought.length} never-bought`
  );

  check(
    "every product carries id, name, brand and price",
    [...payload.dormant, ...payload.neverBought].every((s: { products: unknown[] }) =>
      s.products.every((p) => {
        const product = p as Record<string, unknown>;
        return (
          typeof product.productId === "string" &&
          typeof product.name === "string" &&
          typeof product.brand === "string" &&
          typeof product.price === "number"
        );
      })
    )
  );

  // The prompt is trimmed to the head of each shortlist; the response is not.
  // Measured against the live API this is the difference between one model call
  // per minute and three, on a tier whose binding limit is tokens. (D33)
  check(
    `no shortlist sends more than ${MODEL_SHORTLIST_DEPTH} products`,
    [...payload.dormant, ...payload.neverBought].every(
      (s: { products: unknown[] }) => s.products.length <= MODEL_SHORTLIST_DEPTH
    ),
    `sizes ${[...payload.dormant, ...payload.neverBought].map((s: { products: unknown[] }) => s.products.length).join(",")}`
  );

  check(
    "the full shortlists still reach the response",
    set.dormant.every((s) => s.products.length > MODEL_SHORTLIST_DEPTH) ||
      set.dormant.some((s) => s.products.length === SHORTLIST_SIZE),
    `deepest is ${Math.max(...set.dormant.map((s) => s.products.length))} of ${SHORTLIST_SIZE}`
  );

  check(
    "dormant shortlists carry weeksAgo, never-bought ones do not",
    payload.dormant.every((s: { weeksAgo?: number }) => typeof s.weeksAgo === "number") &&
      payload.neverBought.every((s: { weeksAgo?: number }) => s.weeksAgo === undefined)
  );

  // A cart id in the prompt is an id the model can return, and returning one
  // would be the single most damaging pick it could make (D1).
  check(
    "no cart product id appears anywhere in the prompt",
    SNACK_CART.every((line) => !user.includes(line.productId))
  );

  check(
    "the cart itself is described",
    payload.cart.length === SNACK_CART.length && typeof payload.cartSubtotal === "number",
    `subtotal ₹${payload.cartSubtotal}`
  );

  check(
    "the system prompt states both slot rules and the JSON-only contract",
    SYSTEM_PROMPT.includes("2 dormant picks") &&
      SYSTEM_PROMPT.includes("2 different tiles") &&
      SYSTEM_PROMPT.includes("NO purchase history") &&
      SYSTEM_PROMPT.includes("JSON only")
  );

  check(
    "the never-bought example in the prompt passes our own detector",
    !CLAIMS_HISTORY.test(NEVER_BOUGHT_REASON)
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- determinism -------------------------------------------------------");
{
  const { dormant, neverBought, line } = offered(SNACK_CART);
  const raw = responseOf(
    [
      [dormant[0][1], line(0)],
      [dormant[1][1], line(1)],
    ],
    [
      [neverBought[0][1], "Popular with households near you"],
      [neverBought[1][1], "Common alongside weekly staples"],
    ]
  );

  check(
    "the same response produces byte-identical panels",
    JSON.stringify(panelFrom(SNACK_CART, raw)) ===
      JSON.stringify(panelFrom(SNACK_CART, raw))
  );
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
