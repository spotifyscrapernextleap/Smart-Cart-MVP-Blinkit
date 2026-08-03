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
 *
 * Grew from 76px in Phase 7 to fit the Browse & Replace control, then to 106px
 * so the reason line can wrap to two. Because the skeleton reads the same
 * constant, each was a one-line change and the two cannot drift — which is the
 * reason it was exported in the first place.
 */
export const PANEL_ROW_HEIGHT_CLASS = "h-[106px]";

export default function RecommendationRow({
  row,
  quantity,
  exiting,
  canBrowse,
  onAdd,
  onIncrement,
  onDecrement,
  onBrowse,
}: {
  row: PanelRow;
  quantity: number;
  /** Collapsing out after being added. (EDGE_CASES F2) */
  exiting: boolean;
  /** False when the shortlist has nothing left to offer. (EDGE_CASES F5) */
  canBrowse: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onBrowse: () => void;
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

        {/*
          Three lines: what it is, why it is here, what else there is. The
          prototype put Browse & Replace directly under the name; the reason
          line — which the prototype did not have, and which the idea doc calls
          P0 — now occupies that slot, so the control moves down one line rather
          than competing with it for the same row.

          It is not in the right-hand column: that column is ~70px wide, so the
          label would have to shrink to "Replace", and stacking a third control
          4px from ADD is a mis-tap waiting to happen.
        */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="clamp-1 text-[13px] leading-tight font-semibold text-[var(--color-ink)]">
            {product.name}
          </h3>
          {/*
            Two lines, not one. Clamped to a single line, the longer tile labels
            cut the sentence off mid-fact — "You last ordered from Cleaners &
            Repellents 5 weeks…" loses the word the claim depends on. The reason
            line is the one element the idea doc calls P0, so it gets the room
            it needs and the row height absorbs it.
          */}
          <p className="clamp-2 mt-0.5 text-[11px] leading-tight text-[var(--color-ink-muted)]">
            {row.reason}
          </p>

          {canBrowse ? (
            <button
              type="button"
              onClick={onBrowse}
              disabled={exiting}
              aria-label={`Browse alternatives to ${product.name}`}
              // Padded well past the 11px text so the tap target is ~26px
              // tall, and pulled back on the left so the label still lines up
              // with the name above it. Small text must not mean a small
              // target.
              className="mt-0.5 -ml-1 flex w-fit items-center gap-0.5 py-1.5 pr-2 pl-1 text-[11px] leading-tight font-semibold disabled:opacity-50"
              style={{ color: "var(--color-panel-accent)" }}
            >
              Browse &amp; replace
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            // The shortlist has nothing left to offer. Rendering the label
            // inert states that plainly; opening an empty sheet would not.
            // (EDGE_CASES F5)
            <span className="mt-0.5 block text-[11px] leading-tight text-[var(--color-ink-faint)]">
              No alternatives left
            </span>
          )}
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
