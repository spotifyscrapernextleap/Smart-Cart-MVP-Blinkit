import { SUGGESTED_STAR_RATING } from "@/lib/config";

/**
 * A fixed row of five stars, `SUGGESTED_STAR_RATING` of them filled.
 *
 * Deliberately not per-product and deliberately carrying no review count. This
 * app's premise is a real persona with real purchase history; a varying rating
 * and a "1.4 lac" next to it would be the only numbers on the page that mean
 * nothing, and the reader has no way to tell them apart from the ones that do.
 * A constant is legible as furniture. (Owner's decision, Phase 10.)
 *
 * `aria-hidden` for the same reason — there is no rating here to announce.
 */
export default function StarRating() {
  return (
    <span className="flex items-center gap-px" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill={i < SUGGESTED_STAR_RATING ? "var(--color-brand-yellow-dark)" : "var(--color-hairline)"}
        >
          <path d="m12 17.3-6.2 3.7 1.7-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.5 4.8 1.7 7z" />
        </svg>
      ))}
    </span>
  );
}
