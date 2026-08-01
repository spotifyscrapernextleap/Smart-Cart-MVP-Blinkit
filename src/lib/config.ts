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

/** Pinned so a Groq model deprecation is a one-line fix. See spec §7.5. */
export const GROQ_MODEL = "llama-3.3-70b-versatile";

export const MODEL_TEMPERATURE = 0.3;

/** Fuse.js fuzziness. 0 is exact, 1 matches anything. */
export const SEARCH_THRESHOLD = 0.4;

export const SEARCH_MAX_RESULTS = 40;

/** Events kept in localStorage before the oldest are dropped. */
export const EVENT_LOG_CAP = 500;
