"use client";

import { getTileLabel } from "@/lib/catalogue";
import { addProduct, decrementProduct, incrementProduct } from "@/lib/cartActions";
import { discountPercent } from "@/lib/checkout";
import { useCartQuantity } from "@/lib/useCart";
import type { Product } from "@/lib/types";

import ProductImage from "./ProductImage";
import QuantityStepper from "./QuantityStepper";
import StarRating from "./StarRating";

/**
 * A product card in the "You might also like" grid.
 *
 * Visually richer than `ProductCard` — strikethrough MRP, a percent-off line,
 * a wishlist heart, a rating row and a category chip — because this grid is
 * reproducing the real Blinkit checkout, where those elements are what make
 * the page read as a store rather than a prototype.
 *
 * Two of them are inert on purpose. The heart has no wishlist behind it and
 * the category chip has nowhere to go that this build implements; both are
 * marked `aria-hidden` and are not focusable, so a keyboard or screen-reader
 * user is never handed a control that does nothing. Chrome that lies about
 * being interactive is worse than chrome that is obviously decorative.
 *
 * `cart_add.source` is `"suggested"`, never `"search"` — see `CartAddSource`.
 */
export default function SuggestedProductCard({ product }: { product: Product }) {
  const quantity = useCartQuantity(product.id);
  const percentOff = discountPercent(product);

  const handleAdd = () => addProduct(product, "suggested");
  const handleIncrement = () => incrementProduct(product);
  const handleDecrement = () => decrementProduct(product, quantity);

  return (
    <article className="flex w-full flex-col">
      <div className="relative mb-1.5 flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)]">
        <ProductImage src={product.imagePath} alt={product.name} className="h-full w-full" />

        <span
          className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center"
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-faint)" strokeWidth="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </span>

        <div className="absolute right-1.5 bottom-1.5">
          <QuantityStepper
            quantity={quantity}
            onAdd={handleAdd}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            label={product.name}
          />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-[14px] font-bold text-[var(--color-ink)]">₹{product.price}</span>
        {percentOff > 0 && (
          <span className="text-[11px] text-[var(--color-ink-faint)] line-through">₹{product.mrp}</span>
        )}
      </div>

      {percentOff > 0 && (
        <p className="text-[11px] font-semibold text-[#0f4ba8]">{percentOff}% OFF on MRP</p>
      )}

      <h3 className="clamp-2 mt-0.5 text-[12px] leading-snug font-medium text-[var(--color-ink)]">
        {product.name}
      </h3>

      <div className="mt-1">
        <StarRating />
      </div>

      <span
        className="mt-1.5 inline-flex w-fit items-center gap-0.5 rounded-md bg-[#eef7ef] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-ink-muted)]"
        aria-hidden
      >
        <span className="clamp-1">All {getTileLabel(product.tile)}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </article>
  );
}
