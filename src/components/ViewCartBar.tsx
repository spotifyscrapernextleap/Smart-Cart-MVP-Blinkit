"use client";

import Link from "next/link";

import { useCart } from "@/lib/useCart";

/**
 * Sticky bottom bar showing item count and subtotal, navigating to /cart.
 *
 * Renders nothing when the cart is empty — there is nothing to view. Bottom
 * padding includes the safe-area inset so the bar clears the iOS home
 * indicator rather than sitting under it. (EDGE_CASES F8)
 */
export default function ViewCartBar() {
  const { itemCount, subtotal } = useCart();

  if (itemCount === 0) return null;

  return (
    <div
      className="sticky bottom-0 z-20 bg-[var(--color-surface)] px-3 pt-2"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      <Link
        href="/cart"
        className="flex items-center justify-between rounded-xl bg-[var(--color-brand-green)] px-4 py-3 text-white shadow-lg"
      >
        <span className="text-[13px] font-semibold">
          {itemCount} item{itemCount === 1 ? "" : "s"} · ₹{subtotal}
        </span>
        <span className="flex items-center gap-1 text-[14px] font-bold">
          View cart
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
    </div>
  );
}
