"use client";

import { getTileLabel } from "@/lib/catalogue";
import { addProduct, decrementProduct, incrementProduct } from "@/lib/cartActions";
import { useCartQuantity } from "@/lib/useCart";
import type { Product } from "@/lib/types";

import ProductImage from "./ProductImage";
import QuantityStepper from "./QuantityStepper";

/**
 * A product in the search results.
 *
 * Brand is always rendered alongside the name. The catalogue was deduplicated on
 * (product, brand), so the same name legitimately appears under several brands —
 * without the brand line those rows are indistinguishable. (EDGE_CASES A3)
 *
 * Names run to 122 characters, so the title is clamped to two lines. (EDGE_CASES A4)
 *
 * `cart_add`/`cart_remove` fire only on the 0↔1 transition — the moment a
 * product enters or leaves the cart — not on every +/- tap. `cart_add.source`
 * exists to attribute which channel a product entered through; logging it again
 * on a later "+" tap would misattribute a pure quantity bump as a fresh search
 * conversion and inflate that channel's numbers for no reason. This mirrors why
 * `slot` is load-bearing on panel events (spec §3.6): the event has to mean the
 * thing it is named, not every keystroke of interaction with it.
 */
export default function ProductCard({ product }: { product: Product }) {
  const quantity = useCartQuantity(product.id);

  const handleAdd = () => addProduct(product, "search");
  const handleIncrement = () => incrementProduct(product);
  const handleDecrement = () => decrementProduct(product, quantity);

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
        <QuantityStepper
          quantity={quantity}
          onAdd={handleAdd}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          label={product.name}
        />
      </div>
    </article>
  );
}
