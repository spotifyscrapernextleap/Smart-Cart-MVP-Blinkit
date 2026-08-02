"use client";

import { getProduct } from "@/lib/catalogue";
import { decrementProduct, incrementProduct } from "@/lib/cartActions";
import type { ProductId } from "@/lib/types";

import ProductImage from "./ProductImage";
import QuantityStepper from "./QuantityStepper";

/**
 * One line item on the cart page.
 *
 * Only ever rendered for a product already in the cart (quantity ≥ 1), so its
 * own "+" can never be the moment a product enters the cart — that transition,
 * and the `cart_add` log that marks it, only happens on ProductCard's ADD.
 * Decrementing to 0 here is the same "leaves the cart" moment as anywhere else,
 * so it logs `cart_remove` on that transition, same as ProductCard.
 *
 * `getProduct` should always resolve — cart.ts drops any id the catalogue no
 * longer has before this ever renders (EDGE_CASES C2) — but the guard costs
 * nothing and turns a broken rebuild into a missing row instead of a crash.
 */
export default function CartLine({
  productId,
  quantity,
}: {
  productId: ProductId;
  quantity: number;
}) {
  const product = getProduct(productId);
  if (!product) return null;

  const handleIncrement = () => incrementProduct(product);
  const handleDecrement = () => decrementProduct(product, quantity);

  return (
    <li className="flex gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]">
        <ProductImage src={product.imagePath} alt={product.name} className="h-full w-full" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h3 className="clamp-2 text-[13px] leading-snug font-medium text-[var(--color-ink)]">
          {product.name}
        </h3>
        <p className="clamp-1 text-[11px] text-[var(--color-ink-muted)]">{product.brand}</p>
        <p className="mt-0.5 text-[13px] font-semibold">₹{product.price * quantity}</p>
      </div>

      <div className="flex shrink-0 items-center">
        <QuantityStepper
          quantity={quantity}
          onAdd={handleIncrement}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          label={product.name}
        />
      </div>
    </li>
  );
}
