"use client";

import { getSuggestedProducts } from "@/lib/checkout";
import type { CartLine } from "@/lib/types";

import SuggestedProductCard from "./SuggestedProductCard";

/**
 * "You might also like" — complements drawn from the cart's own tiles.
 *
 * **Not a discovery surface, by construction.** Every product here comes from
 * a tile already represented in the cart, which is precisely the set the Smart
 * Cart panel excludes (D1a). The two sections cannot collide, and this one
 * reads as "more of what you are buying" while the panel keeps sole ownership
 * of "something you did not think to look for".
 *
 * It sits *below* Bill details rather than in the real Blinkit slot directly
 * under the basket, because that slot belongs to the Smart Cart panel and the
 * panel is the deliverable. Owner's decision, Phase 10.
 *
 * Renders nothing when the cart's tiles cannot supply any candidates — an
 * empty frame is worse than an absent one.
 */
export default function YouMightAlsoLike({ lines }: { lines: CartLine[] }) {
  const products = getSuggestedProducts(lines);
  if (products.length === 0) return null;

  return (
    <section className="mx-3 mt-3 rounded-xl bg-[var(--color-surface)] px-4 py-4">
      <h2 className="mb-3 text-[15px] font-bold text-[var(--color-ink)]">You might also like</h2>
      <div className="grid grid-cols-3 gap-x-2.5 gap-y-4">
        {products.map((product) => (
          <SuggestedProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
