"use client";

import { getProduct } from "@/lib/catalogue";
import type { PanelRow } from "@/lib/types";

import ProductImage from "./ProductImage";
import QuantityStepper from "./QuantityStepper";

/**
 * One Smart Cart suggestion.
 *
 * Layout follows the prototype: image, then name over its reason line, with the
 * control stacked above the price on the right.
 *
 * Two deliberate departures from the prototype, both mandated by the project's
 * own documents:
 *
 *  - The control is **ADD**, becoming a stepper only after the first tap. The
 *    prototype's "− 0 +" is the exact overload the idea doc §7 flags as a
 *    required fix: one control with two meanings and the destructive one as the
 *    default state, so a user going 2 → 1 → 0 falls off a cliff into deletion.
 *  - Every row carries a **reason line**. The prototype has none, but the idea
 *    doc calls it P0 and "not decorative" — it is the only element in the design
 *    that builds mindspace, and a tile without one is just inventory.
 *
 * Price is rendered plain. `mrp` exists in the data but stays unrendered until
 * there is a way to separate recommendation lift from discount lift (spec §8).
 */

/**
 * Fixed row height, shared with the panel's skeleton so the two are identical by
 * construction rather than by coincidence. The Bill details block must not shift
 * when the panel resolves. (EDGE_CASES F1)
 */
export const PANEL_ROW_HEIGHT_CLASS = "h-[76px]";

export default function RecommendationRow({
  row,
  quantity,
  exiting,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  row: PanelRow;
  quantity: number;
  /** Collapsing out after being added. (EDGE_CASES F2) */
  exiting: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const product = getProduct(row.productId);
  if (!product) return null;

  return (
    <li
      data-exiting={exiting || undefined}
      className="panel-row border-t border-[color-mix(in_srgb,var(--color-panel-accent)_14%,transparent)] first:border-t-0"
    >
      <div className={`flex items-center gap-3 px-3 ${PANEL_ROW_HEIGHT_CLASS}`}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <ProductImage src={product.imagePath} alt={product.name} className="h-full w-full" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="clamp-1 text-[13px] leading-tight font-semibold text-[var(--color-ink)]">
            {product.name}
          </h3>
          <p className="clamp-1 mt-0.5 text-[11px] leading-tight text-[var(--color-ink-muted)]">
            {row.reason}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <QuantityStepper
            quantity={quantity}
            onAdd={onAdd}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            label={product.name}
            tone="violet"
            // Once added the row is already collapsing away; a second tap in
            // that window would silently add a second unit. (EDGE_CASES F4)
            disabled={exiting}
          />
          <span className="text-[13px] font-semibold">₹{product.price}</span>
        </div>
      </div>
    </li>
  );
}
