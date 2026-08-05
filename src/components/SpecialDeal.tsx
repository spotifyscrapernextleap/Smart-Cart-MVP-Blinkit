"use client";

import { addProduct, decrementProduct, incrementProduct } from "@/lib/cartActions";
import { getSpecialDeal } from "@/lib/checkout";
import { useCartQuantity } from "@/lib/useCart";
import type { CartLine, Product } from "@/lib/types";

import ProductImage from "./ProductImage";
import QuantityStepper from "./QuantityStepper";

/**
 * "Special deal for you!" — one discounted complement, at the top of checkout.
 *
 * Same cart-adjacent pool as "You might also like", so it is not a discovery
 * surface either (see `checkout.ts`), and drawn from below that grid so the
 * deal is never a product repeated six rows further down.
 *
 * The lavender tint is the same `--color-panel-tint` the Smart Cart panel
 * uses, which is a deliberate risk worth naming: two tinted blocks on one page
 * could read as the same feature. They are told apart by position and by
 * content — this one is a single row above the basket with a price crossed
 * out, the panel is four rows below it with reason lines and no discount. If
 * they ever start looking alike, this is the one that should change colour.
 */
function DealRow({ product }: { product: Product }) {
  const quantity = useCartQuantity(product.id);

  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-panel-accent)_22%,transparent)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-3 p-2.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]">
          <ProductImage src={product.imagePath} alt={product.name} className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="clamp-2 text-[13px] leading-snug font-semibold text-[var(--color-ink)]">
            {product.name}
          </h3>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[13px] font-bold">₹{product.price}</span>
            <span className="text-[11px] text-[var(--color-ink-faint)] line-through">₹{product.mrp}</span>
          </p>
        </div>

        <div className="shrink-0">
          <QuantityStepper
            quantity={quantity}
            onAdd={() => addProduct(product, "suggested")}
            onIncrement={() => incrementProduct(product)}
            onDecrement={() => decrementProduct(product, quantity)}
            label={product.name}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-b-xl bg-[var(--color-panel-tint)] px-2.5 py-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-panel-accent)" strokeWidth="2" className="shrink-0" aria-hidden>
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 7-2.6" strokeLinecap="round" />
        </svg>
        <p className="text-[11px] text-[var(--color-panel-accent)]">
          Yay! Special deal unlocked.{" "}
          <span className="font-bold">Add this item to your cart</span>
        </p>
      </div>
    </div>
  );
}

export default function SpecialDeal({ lines }: { lines: CartLine[] }) {
  const product = getSpecialDeal(lines);
  if (!product) return null;

  return (
    <section className="mx-3 mt-3 rounded-xl bg-[var(--color-surface)] px-3 py-3">
      <h2 className="mb-2.5 text-[15px] font-bold text-[var(--color-ink)]">Special deal for you!</h2>
      <DealRow product={product} />
    </section>
  );
}
