/**
 * The model prompt. (Build spec §4, Step 8)
 *
 * The model is handed all seven shortlists — three dormant, four never-bought —
 * and asked for one pick per slot type from two *different* tiles each. It is
 * choosing **within a set of options that are already legal**: every exclusion
 * the spec calls non-negotiable was applied in `shortlist.ts` before this file
 * runs, so there is no instruction here the model could disobey to produce an
 * invalid panel. What it adds is plausibility — which of twelve legal pet
 * products actually suits a cart of atta and namkeen — and that is the one
 * judgement the deterministic path cannot make.
 *
 * Everything variable is passed as JSON values rather than interpolated prose.
 * Product names come from our own committed catalogue, but they are still data
 * being fed to a model, and a name is a place a sentence can hide.
 * (EDGE_CASES E9)
 */

import { getProduct } from "../catalogue.ts";
import {
  MODEL_SHORTLIST_DEPTH,
  REASON_MAX_CHARS,
  REASON_MAX_WORDS,
} from "../config.ts";
import type { CartLine } from "../types";

import type { Shortlist, ShortlistSet } from "./shortlist.ts";
import { NEVER_BOUGHT_REASON, weeksAgoFrom } from "./templates.ts";

interface PromptProduct {
  productId: string;
  name: string;
  brand: string;
  price: number;
}

interface PromptShortlist {
  tile: string;
  tileLabel: string;
  /** Dormant tiles only. The value the model must quote in its reason line. */
  weeksAgo?: number;
  products: PromptProduct[];
}

function describe(shortlist: Shortlist): PromptShortlist {
  const described: PromptShortlist = {
    tile: shortlist.tile,
    tileLabel: shortlist.tileLabel,
    // Only the head of the list goes to the model — the full twelve still ship
    // in the response for Browse & Replace. See MODEL_SHORTLIST_DEPTH.
    products: shortlist.products.slice(0, MODEL_SHORTLIST_DEPTH).map((product) => ({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
    })),
  };

  if (shortlist.slot === "A" && shortlist.mostRecentDaysAgo !== null) {
    described.weeksAgo = weeksAgoFrom(shortlist.mostRecentDaysAgo);
  }

  return described;
}

/**
 * The cart as the model sees it: what is in it and what kind of shop it is.
 * Ids are omitted deliberately — nothing in the cart is selectable, so giving
 * the model cart ids only creates ids it could return by mistake.
 */
function describeCart(cart: CartLine[]) {
  return cart.flatMap((line) => {
    const product = getProduct(line.productId);
    if (!product) return [];
    return [
      {
        name: product.name,
        brand: product.brand,
        tile: product.tile,
        price: product.price,
        quantity: line.quantity,
      },
    ];
  });
}

export const SYSTEM_PROMPT = [
  "You choose grocery recommendations for an Indian quick-commerce app.",
  "",
  "You are given a shopper's current cart and seven shortlists of products.",
  "Every product in every shortlist is already allowed to be recommended.",
  "Your only job is to choose which ones most plausibly belong alongside this",
  "cart, and to write one short reason line for each.",
  "",
  "Shortlists are of two kinds:",
  '- "dormant": categories this shopper used to buy from and has not recently.',
  '- "neverBought": categories this shopper has never bought from at all.',
  "",
  "How to choose:",
  "Products are listed in order of overall popularity, NOT in order of how well",
  "they suit this cart. The first product in a list is frequently the wrong",
  "answer. Read the whole list and pick what a household buying THIS cart would",
  "plausibly want. Reject anything that serves a specific need this cart shows",
  "no evidence of — a cart of snacks and staples is no reason to suggest infant",
  "feeding equipment or pet accessories for a pet nobody has mentioned. If",
  "nothing in a list fits the cart especially well, choose the item the widest",
  "range of households would use.",
  "",
  "Rules:",
  "1. Return exactly 2 dormant picks, from 2 different tiles.",
  "2. Return exactly 2 neverBought picks, from 2 different tiles.",
  "3. Every productId must be copied exactly from the shortlists provided.",
  "   Never invent an id, and never return one from the cart.",
  "4. A dormant reason line refers to the CATEGORY, not the product — the",
  "   shopper probably never bought this specific item, so never say they",
  "   ordered *this*. The line MUST contain the tileLabel exactly as given, and",
  "   the supplied weeksAgo value.",
  '   Example: "You last ordered from Pet Store 7 weeks ago".',
  "5. A neverBought reason line must claim NO purchase history of any kind.",
  "   This shopper has never bought from that category, so any suggestion that",
  "   they ordered it, used it, are restocking it, or are buying it again is a",
  "   lie. Use inference or locality only.",
  `   Example: "${NEVER_BOUGHT_REASON}".`,
  `6. Reason lines: no exclamation marks, and no commands telling the shopper`,
  `   what to do. Keep neverBought lines to ${REASON_MAX_WORDS} words or fewer. A dormant`,
  "   line may run longer if the category name needs the room, but never past",
  `   ${REASON_MAX_CHARS} characters.`,
  "7. Respond with JSON only, in exactly this shape:",
  "",
  "{",
  '  "dormant": [',
  '    { "productId": "p_00417", "reason": "You last ordered from Pet Store 7 weeks ago" },',
  '    { "productId": "p_01120", "reason": "You last ordered from Bakery 5 weeks ago" }',
  "  ],",
  '  "neverBought": [',
  '    { "productId": "p_00733", "reason": "Popular with households near you" },',
  '    { "productId": "p_01455", "reason": "Common alongside weekly staples" }',
  "  ]",
  "}",
].join("\n");

/**
 * The user message. Built as JSON so that a product name containing something
 * that reads like an instruction arrives as a string value, not as a line of
 * the prompt.
 */
export function buildUserPrompt(cart: CartLine[], set: ShortlistSet): string {
  return JSON.stringify(
    {
      cart: describeCart(cart),
      cartSubtotal: Math.round(set.subtotal),
      dormant: set.dormant.map(describe),
      neverBought: set.neverBought.map(describe),
      reasonMaxWords: REASON_MAX_WORDS,
      reasonMaxCharacters: REASON_MAX_CHARS,
    }
    // Compact, with no indentation. Pretty-printing this payload cost ~700
    // tokens of pure whitespace against a per-minute budget the panel has
    // already been rate-limited by.
  );
}
