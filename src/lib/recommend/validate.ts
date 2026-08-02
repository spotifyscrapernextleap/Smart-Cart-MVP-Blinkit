/**
 * Validation of the model's response. (Build spec §4, Step 9)
 *
 * This file exists because the prompt is not enforcement. Everything the spec
 * calls non-negotiable was already made structurally impossible in
 * `shortlist.ts` — the model cannot exceed the price ceiling or recommend
 * something in the cart, because no such candidate was ever offered to it. What
 * remains reachable is what the model *writes*, and what it *claims to have
 * chosen*, and both are checked here.
 *
 * Two grades of failure, deliberately kept apart:
 *
 *  - **A bad product** — an id from nowhere, or a second pick from a tile
 *    already used — discards the entry. The slot is refilled from the next
 *    unused shortlist of the same type with a template line. (spec Step 9)
 *  - **A bad reason** discards only the line, not the pick. The model's
 *    judgement about *which* product suits the cart is the thing it was called
 *    for and is unaffected by it having written a sentence we will not show.
 *    The template line replaces it.
 *
 * A response where nothing survives returns null, and the route falls back —
 * because a panel with no surviving model input is byte-identical to the
 * deterministic one, and reporting it as `source: "model"` would put a false
 * entry in the very event log that exists to tell those two apart.
 */

import { REASON_MAX_CHARS } from "../config.ts";
import type { ProductId, SlotType, TileId } from "../types";

import { SLOTS_PER_TYPE, selectPanelShortlists } from "./fallback.ts";
import type { Shortlist, ShortlistSet } from "./shortlist.ts";

export interface ModelPick {
  productId: ProductId;
  /** Null when the model's line was rejected and the template must be used. */
  reason: string | null;
}

export interface ResolvedPanel {
  /** Exactly the shortlists that will become rows, ordered A, A, B, B. */
  shortlists: Shortlist[];
  /** Keyed by tile. Absent for a row the model did not successfully fill. */
  choices: Map<TileId, ModelPick>;
  /** How many of the four rows the model actually decided. Diagnostic only. */
  modelRowCount: number;
}

/**
 * A never-bought reason line that claims the user has bought before.
 *
 * The shape is taken from `phases/phase-4-recommend/verify_recommend.ts`, where
 * it is self-tested against 9 lines that must be rejected and 4 that must be
 * accepted — the first version of that detector passed everything, which is the
 * whole reason the self-test exists. Do not "simplify" this to banning the word
 * "you": the spec's own canonical never-bought line is "Popular with households
 * near you", a locality claim and not a history claim. What has to be caught is
 * a claim of prior purchase. (EDGE_CASES E2)
 */
export const CLAIMS_HISTORY =
  /\byou(?:'ve| have)?\s+(?:ordered|bought|purchased|tried|last|used|loved)\b|\byour\s+(?:order|purchase|usual|last)\b|\bagain\b|\bused to\b|\blast time\b|\bre-?order\b|\brestock\b/i;

/**
 * Pulls the JSON object out of whatever the model actually returned.
 *
 * JSON mode is requested, but §7.5 is explicit that open-weights models follow
 * strict schemas less reliably — markdown fences are the common failure
 * (EDGE_CASES E5), and a reasoning model can additionally emit its thinking
 * inline rather than in the separate field. Both are stripped, then the outer
 * braces are located rather than assumed, so leading prose cannot break the
 * parse on its own.
 */
export function extractJson(raw: string): string | null {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1];

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  return text.slice(start, end + 1);
}

function readPicks(value: unknown): ModelPick[] {
  if (!Array.isArray(value)) return [];

  const picks: ModelPick[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { productId, reason } = entry as { productId?: unknown; reason?: unknown };
    if (typeof productId !== "string") continue;
    picks.push({ productId, reason: typeof reason === "string" ? reason : "" });
  }
  return picks;
}

/**
 * Returns the line to show, or null if it fails and the template should be used.
 *
 * Exclamation marks are stripped rather than rejected: the tone rule is the
 * model's to break, but a single "!" is not a reason to throw away an otherwise
 * good line. Length and false claims are rejections. (EDGE_CASES E8, E2, E10)
 *
 * The two slot types are checked in opposite directions, and neither check
 * makes sense on the other:
 *
 *  - **Slot B** may claim no purchase history at all, because none exists.
 *  - **Slot A** may claim history, but only about the *category*. The product
 *    on a dormant row is picked by bestseller rank and is usually not one the
 *    persona ever bought, so "you used to order this regularly" — which is the
 *    build spec's own example line — is false about the specific item on
 *    screen. Requiring the tile label is a positive test for the rule spec §4
 *    Step 8 states in prose ("reference the tile, not the specific product"),
 *    and it is stricter than blacklisting "this": a line that names the
 *    category cannot be read as a claim about the item.
 */
export function sanitiseReason(
  raw: string,
  slot: SlotType,
  tileLabel = ""
): string | null {
  const cleaned = raw.replace(/!/g, "").replace(/\s+/g, " ").trim();

  if (cleaned.length === 0) return null;
  if (cleaned.length > REASON_MAX_CHARS) return null;

  if (slot === "B") {
    return CLAIMS_HISTORY.test(cleaned) ? null : cleaned;
  }

  return cleaned.toLowerCase().includes(tileLabel.toLowerCase()) ? cleaned : null;
}

/**
 * Matches the model's picks to the shortlists they claim to come from.
 *
 * A pick survives only if its id is genuinely in one of the shortlists offered
 * for that slot type and that tile has not already been used — which is how the
 * four-distinct-tiles rule is enforced against the model rather than requested
 * of it. At most `SLOTS_PER_TYPE` survive; anything after that is surplus.
 */
function resolveSide(
  picks: ModelPick[],
  offered: Shortlist[],
  slot: SlotType,
  usedTiles: Set<TileId>
): { shortlist: Shortlist; pick: ModelPick }[] {
  const resolved: { shortlist: Shortlist; pick: ModelPick }[] = [];

  for (const pick of picks) {
    if (resolved.length >= SLOTS_PER_TYPE) break;

    const shortlist = offered.find(
      (candidate) =>
        candidate.slot === slot &&
        candidate.products.some((product) => product.id === pick.productId)
    );
    if (!shortlist) continue; // hallucinated, or from the other slot type
    if (usedTiles.has(shortlist.tile)) continue; // two rows from one tile

    // A rejected line does not reject the pick. `null` here means the row keeps
    // the model's product and takes the template line, which is the outcome
    // EDGE_CASES E2 asks for: discard the claim, not the recommendation.
    const reason = sanitiseReason(pick.reason ?? "", slot, shortlist.tileLabel);

    usedTiles.add(shortlist.tile);
    resolved.push({ shortlist, pick: { productId: pick.productId, reason } });
  }

  return resolved;
}

/**
 * Turns a raw model response into the four shortlists that become rows, plus
 * the per-tile choice for each row the model successfully filled.
 *
 * Backfill is delegated to `selectPanelShortlists` rather than reimplemented:
 * the surviving picks are moved to the front of their own type's list and the
 * existing selection runs unchanged, so a shortfall is filled by the next
 * unused shortlist of the same type first and across types second — identical
 * behaviour to the deterministic path, and the always-four-rows guarantee (D14)
 * holds without a second copy of the rule.
 */
export function resolveModelPanel(set: ShortlistSet, raw: string): ResolvedPanel | null {
  const json = extractJson(raw);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const body = parsed as { dormant?: unknown; neverBought?: unknown };
  const usedTiles = new Set<TileId>();

  const dormant = resolveSide(readPicks(body.dormant), set.dormant, "A", usedTiles);
  const neverBought = resolveSide(
    readPicks(body.neverBought),
    set.neverBought,
    "B",
    usedTiles
  );

  // Nothing usable came back. A panel built from this would be the fallback
  // wearing the model's name.
  if (dormant.length + neverBought.length === 0) return null;

  const unused = (shortlist: Shortlist) => !usedTiles.has(shortlist.tile);
  const shortlists = selectPanelShortlists({
    ...set,
    dormant: [...dormant.map((r) => r.shortlist), ...set.dormant.filter(unused)],
    neverBought: [...neverBought.map((r) => r.shortlist), ...set.neverBought.filter(unused)],
  });

  const choices = new Map<TileId, ModelPick>();
  for (const { shortlist, pick } of [...dormant, ...neverBought]) {
    choices.set(shortlist.tile, pick);
  }

  // A surviving pick whose shortlist did not make the final four — possible if
  // the model filled one type twice and the other not at all — is not a row, so
  // it does not count.
  const modelRowCount = shortlists.filter((s) => choices.has(s.tile)).length;

  return { shortlists, choices, modelRowCount };
}
