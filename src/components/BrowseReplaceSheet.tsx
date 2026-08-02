"use client";

import { useEffect, useRef } from "react";

import { getTileLabel } from "@/lib/catalogue";
import { SHEET_ENTER_MS } from "@/lib/config";
import type { PanelRow, Product } from "@/lib/types";

import ProductImage from "./ProductImage";

/**
 * The Browse & Replace bottom sheet. (Build spec §6 Phase 7)
 *
 * Opens from memory. `alternatives` is derived from the `shortlists` the
 * recommend response already carried, so there is no network call, no loading
 * state and nothing to fail — which is the whole reason the response ships the
 * full ranked lists rather than just the four chosen products.
 *
 * The sheet is a modal: it traps nothing elaborate, but it does take focus,
 * close on Escape and on backdrop tap, and lock the page behind it. Without the
 * scroll lock the checkout page scrolls under the sheet on iOS, which reads as
 * the sheet sliding around.
 */
export default function BrowseReplaceSheet({
  row,
  alternatives,
  onSelect,
  onClose,
}: {
  row: PanelRow;
  /** Already filtered: never the displayed product, never anything in the cart. */
  alternatives: Product[];
  onSelect: (productId: string) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = `browse-replace-${row.position}`;

  useEffect(() => {
    // Restored on unmount so a sheet opened from a scrolled page does not
    // silently reset the scroll position when it closes.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ "--sheet-enter": `${SHEET_ENTER_MS}ms` } as React.CSSProperties}
    >
      <div
        className="sheet-backdrop absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[480px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className="sheet-panel flex max-h-[70vh] flex-col rounded-t-2xl bg-[var(--color-surface)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-start gap-2 border-b border-[var(--color-hairline)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2
                id={headingId}
                className="text-[15px] leading-tight font-bold text-[var(--color-ink)]"
              >
                Browse &amp; replace
              </h2>
              <p className="mt-0.5 text-[12px] leading-tight text-[var(--color-ink-muted)]">
                More from {getTileLabel(row.tile)}
              </p>
            </div>

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close browse and replace"
              className="-mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-ink-muted)]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {alternatives.map((product) => (
              <li
                key={product.id}
                className="border-b border-[var(--color-hairline)] last:border-b-0"
              >
                {/*
                  The whole row is the control. Inside a modal whose only
                  purpose is picking one item there is no competing action for
                  a mis-tap to hit — unlike the panel row itself, where a
                  full-row target would sit under the ADD button.
                */}
                <button
                  type="button"
                  onClick={() => onSelect(product.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--color-surface-sunken)]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]">
                    <ProductImage
                      src={product.imagePath}
                      alt={product.name}
                      className="h-full w-full"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Brand is rendered alongside the name because duplicate
                        names across brands are common in this catalogue and
                        read as identical rows without it. (EDGE_CASES A3) */}
                    <p className="clamp-2 text-[13px] leading-tight font-semibold text-[var(--color-ink)]">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-[var(--color-ink-muted)]">
                      {product.brand}
                    </p>
                  </div>

                  <span className="shrink-0 text-[13px] font-semibold">₹{product.price}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
