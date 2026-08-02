/**
 * Template reason lines. (Build spec §4, Step 10)
 *
 * Used by the deterministic path, and by validation when an individual model
 * pick is discarded and replaced. Every line here is true by construction —
 * the dormant line states a fact taken straight from the persona's history, and
 * the never-bought line claims no history at all, because none exists.
 */

const DAYS_PER_WEEK = 7;

/**
 * The single place a dormancy gap becomes a number of weeks.
 *
 * Exported because the prompt hands the model a `weeksAgo` value to write into
 * its own dormant line (spec §4 Step 8), and that value has to be the same one
 * the template would have produced — otherwise a model line and a template line
 * on the same tile can disagree about how long ago the user was last here.
 */
export function weeksAgoFrom(daysAgo: number): number {
  return Math.max(1, Math.round(daysAgo / DAYS_PER_WEEK));
}

/**
 * "You last ordered from Pet Store 7 weeks ago"
 *
 * References the *tile*, never the specific product: the product being shown is
 * usually not one the persona previously bought, so "you last ordered this"
 * would be false. (Build spec §4, Step 8)
 */
export function dormantReason(tileLabel: string, daysAgo: number | null): string {
  if (daysAgo === null) return `You have not ordered from ${tileLabel} recently`;
  const weeks = weeksAgoFrom(daysAgo);
  return `You last ordered from ${tileLabel} ${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

/**
 * The never-bought line is inference and locality only.
 *
 * No user-specific fact exists for a category the user has never purchased
 * from — the idea doc names this as the feature's structural weakness rather
 * than papering over it. Claiming history here would be a lie on precisely the
 * slot type whose job is earning trust.
 */
export const NEVER_BOUGHT_REASON = "Popular with households near you";

export function neverBoughtReason(): string {
  return NEVER_BOUGHT_REASON;
}
