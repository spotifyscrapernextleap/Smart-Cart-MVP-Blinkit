"use client";

import Link from "next/link";

import BillDetails from "@/components/BillDetails";
import CartLine from "@/components/CartLine";
import { useCart } from "@/lib/useCart";

/**
 * CART.
 *
 * Cart line items, then Bill details. The Smart Cart panel lands between them
 * in Phase 5 — this phase builds the page it will be inserted into.
 *
 * Reachable directly by URL with an empty cart (no minimum-cart-size gate per
 * the idea doc §5), so the empty state is handled now rather than left to crash.
 */
function CartHeader() {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-hairline)] bg-[var(--color-surface)] px-2 py-3">
      <Link href="/" aria-label="Back to home" className="rounded-lg p-2 text-[var(--color-ink)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <h1 className="text-[16px] font-bold text-[var(--color-ink)]">My Cart</h1>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-20 text-center">
      <p className="text-[15px] font-semibold text-[var(--color-ink)]">Your cart is empty</p>
      <p className="text-[13px] text-[var(--color-ink-muted)]">
        Search for something to add it here.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-[var(--color-brand-green)] px-5 py-2 text-[13px] font-bold text-white"
      >
        Start shopping
      </Link>
    </div>
  );
}

export default function CartPage() {
  const { lines, subtotal } = useCart();

  return (
    <main className="flex flex-1 flex-col">
      <CartHeader />

      {lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <ul className="flex flex-col gap-4 px-4 py-4">
            {lines.map((line) => (
              <CartLine key={line.productId} productId={line.productId} quantity={line.quantity} />
            ))}
          </ul>

          {/* Smart Cart panel — Phase 5 */}

          <BillDetails subtotal={subtotal} />
        </>
      )}
    </main>
  );
}
