"use client";

import { getTileLabel } from "@/lib/catalogue";
import type { Product } from "@/lib/types";

import ProductImage from "./ProductImage";

/**
 * A product in the search results.
 *
 * Brand is always rendered alongside the name. The catalogue was deduplicated on
 * (product, brand), so the same name legitimately appears under several brands —
 * without the brand line those rows are indistinguishable. (EDGE_CASES A3)
 *
 * Names run to 122 characters, so the title is clamped to two lines. (EDGE_CASES A4)
 *
 * The ADD control is wired to the cart in Phase 3. It is rendered here so the
 * card's layout is final and does not shift when the behaviour lands.
 */
export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="flex w-full flex-col rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-2.5">
      <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]">
        <ProductImage
          src={product.imagePath}
          alt={product.name}
          className="h-full w-full"
        />
      </div>

      <p className="text-[10px] tracking-wide text-[var(--color-ink-faint)] uppercase">
        {getTileLabel(product.tile)}
      </p>
      <h3 className="clamp-2 text-[13px] leading-snug font-medium text-[var(--color-ink)]">
        {product.name}
      </h3>
      <p className="clamp-1 mt-0.5 text-[11px] text-[var(--color-ink-muted)]">
        {product.brand}
      </p>

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-[14px] font-semibold">₹{product.price}</span>
        <button
          type="button"
          className="rounded-lg border border-[var(--color-brand-green)] px-3.5 py-1 text-[13px] font-bold text-[var(--color-brand-green)]"
        >
          ADD
        </button>
      </div>
    </article>
  );
}
