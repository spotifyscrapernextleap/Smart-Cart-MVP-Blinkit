/**
 * Every tunable constant in the application.
 *
 * Build spec §7.4: "Nothing in this list may be hardcoded anywhere else in the
 * codebase." If a number in here also appears as a literal in a component or a
 * lib function, that is a bug — the point of this file is that a reviewer can
 * change the feature's behaviour without reading the implementation.
 */

/** A tile is dormant once its most recent order is at least this many days old. */
export const DORMANCY_THRESHOLD_DAYS = 30;

/** Account age required before the panel is eligible to render. */
export const TENURE_MIN_DAYS = 180;

/** How many dormant tiles are shortlisted and offered to the model. */
export const DORMANT_TILES_OFFERED = 3;

/** How many never-bought tiles are shortlisted and offered to the model. */
export const NEVERBOUGHT_TILES_OFFERED = 4;

/** Products per tile shortlist. Also the depth available to Browse & Replace. */
export const SHORTLIST_SIZE = 12;

/** Never-bought price ceiling, as a fraction of the cart subtotal. */
export const PRICE_CEILING_RATIO = 0.5;

/** Never-bought price ceiling floor, in rupees. There is no upper cap. */
export const PRICE_CEILING_FLOOR = 100;

/** Abort the model call after this long and fall back. */
export const MODEL_TIMEOUT_MS = 4000;

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/**
 * Pinned so a Groq model deprecation is a one-line fix. See spec §7.5.
 *
 * The spec names `llama-3.3-70b-versatile`; this project runs GPT-OSS 120B
 * instead — an owner decision, logged as PROJECT_MEMORY D32. It is a larger
 * open-weights model with materially better instruction-following on the two
 * things this prompt actually needs: staying inside a supplied id list, and not
 * writing a history claim into a never-bought line.
 */
export const GROQ_MODEL = "openai/gpt-oss-120b";

export const MODEL_TEMPERATURE = 0.3;

/** Fuse.js fuzziness. 0 is exact, 1 matches anything. */
export const SEARCH_THRESHOLD = 0.4;

export const SEARCH_MAX_RESULTS = 40;

/** Events kept in localStorage before the oldest are dropped. */
export const EVENT_LOG_CAP = 500;

// ---------------------------------------------------------------------------
// Beyond build spec §7.4.
//
// Tunables the spec did not anticipate. They live here rather than inline
// because this file's contract is that it holds every tunable — see
// PROJECT_MEMORY decision D10.
// ---------------------------------------------------------------------------

/**
 * Worst Fuse score still shown. 0 is a perfect match, 1 is unrelated.
 *
 * `SEARCH_THRESHOLD` bounds each per-key match, but Fuse's weighted total can
 * exceed it, so without this `maggi` returned three real MAGGI products (0.00)
 * followed by 37 rows ending in "Liner Magique Eyeliner" (0.67), and `iphone`
 * returned 40 rows of honey and hair conditioner.
 *
 * 0.35 sits in a wide empty gap in the measured distribution: queries the
 * catalogue can answer score 0.00–0.21 (`maggi` 0.00, `dog food` 0.21), and
 * queries it cannot score 0.52–0.79 (`petrol` 0.52, `furniture` 0.79). Products
 * that genuinely exist stay on the right side of it — `condoms` scores 0.05 and
 * `beer` 0.18, and both are in the catalogue.
 */
export const SEARCH_MAX_SCORE = 0.35;

/**
 * Cart line quantity bounds. Below 1 the line is dropped rather than shown at
 * zero; above 99 is not a real basket and almost certainly a corrupted or
 * hand-edited value. (EDGE_CASES C5)
 */
export const MIN_CART_QUANTITY = 1;
export const MAX_CART_QUANTITY = 99;

/**
 * Most never-bought tiles offered from any single section.
 *
 * Never-bought tiles are ordered by how little the persona has bought from
 * their section, and this persona has zero orders across all seven Beauty &
 * Personal Care tiles — so without a cap, all four offered tiles come from that
 * one section and both slot-B rows are near-identical in kind. The cap keeps
 * every offered tile in a barely-touched section while leaving the model, and
 * Browse & Replace, a real choice. (EDGE_CASES D6)
 */
export const MAX_TILES_PER_SECTION_OFFERED = 2;

/**
 * Cart signatures kept in `sc_panel_cache` before the oldest are evicted.
 * One entry per distinct cart the user has taken to checkout, so without a cap
 * it grows for the life of the browser profile. (EDGE_CASES C7)
 */
export const PANEL_CACHE_MAX_ENTRIES = 20;

/**
 * How long a row takes to collapse out of the panel after being added.
 *
 * The spec forbids a layout shift when the panel *resolves*, and separately
 * forbids backfilling after an add — so removing a row necessarily shrinks the
 * panel and moves Bill details up. Animating that makes it read as a
 * consequence of the user's own tap rather than a glitch. (EDGE_CASES F2)
 */
export const PANEL_ROW_EXIT_MS = 220;

/**
 * How long the Browse & Replace sheet takes to rise into view.
 *
 * Passed into `globals.css` as an inline custom property by the sheet itself,
 * for the same reason as `PANEL_ROW_EXIT_MS`: config.ts is contractually the
 * only home for a tunable, and CSS cannot import TypeScript. (D10)
 */
export const SHEET_ENTER_MS = 200;

/**
 * Reasoning budget for GPT-OSS. Not a parameter the spec anticipated, because
 * `llama-3.3-70b-versatile` is not a reasoning model and GPT-OSS is (D32).
 *
 * Reasoning tokens are generated before the first content token, so they are
 * spent entirely inside `MODEL_TIMEOUT_MS` (4000) and buy nothing the user can
 * see. The task is a constrained pick from a supplied list, not a problem that
 * rewards deliberation — so this stays at "low". Raise it only with a measured
 * latency number in hand.
 */
export const MODEL_REASONING_EFFORT = "low";

/**
 * Ceiling on the completion. Four picks and four short lines is well under 300
 * tokens; the headroom is for the reasoning block above. A cap matters here
 * because an unbounded reasoning model can spend the whole latency budget
 * thinking and return nothing before the abort.
 */
export const MODEL_MAX_COMPLETION_TOKENS = 1024;

/**
 * Products per shortlist actually shown to the model.
 *
 * `SHORTLIST_SIZE` (12) is the depth Browse & Replace needs, and the response
 * still carries all twelve. The prompt does not: measured against the live API,
 * seven shortlists of twelve cost **4,729 prompt tokens**, and the Groq free
 * tier's binding limit is 8,000 tokens per minute — so the second checkout
 * visit inside a minute returned HTTP 429 and served a fallback panel. An
 * evaluator clicking through two carts would have seen the model path die.
 *
 * Six halves that. The products dropped are ranks 7–12 of a list already sorted
 * by bestseller rank, so what the model loses is the tail it was least likely
 * to pick, while the choice it exists to make — which of the plausible items
 * suits *this* cart — is untouched. (PROJECT_MEMORY D33)
 */
export const MODEL_SHORTLIST_DEPTH = 6;

/**
 * Reason-line bounds. The spec states both — §4 Step 9 validates ≤100
 * characters, §4 Step 8 instructs the model to write at most 8 words — but as
 * prose rather than as constants. They are tunables, so they live here (D10).
 * The word limit is an instruction to the model; the character limit is the one
 * enforced in validation, because it is the one that protects the layout.
 */
export const REASON_MAX_CHARS = 100;
export const REASON_MAX_WORDS = 8;
