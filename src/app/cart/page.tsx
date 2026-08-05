"use client";

import { useState } from "react";
import Link from "next/link";

import BillDetails from "@/components/BillDetails";
import CartLine from "@/components/CartLine";
import DonationCard from "@/components/DonationCard";
import PlaceOrderBar from "@/components/PlaceOrderBar";
import SmartCartPanel from "@/components/SmartCartPanel";
import SpecialDeal from "@/components/SpecialDeal";
import TipCard from "@/components/TipCard";
import YouMightAlsoLike from "@/components/YouMightAlsoLike";
import {
  AddGstin,
  CancellationPolicy,
  DeliveryInstructions,
  GiftPackaging,
  UseCoupons,
} from "@/components/CheckoutExtras";
import { computeBill } from "@/lib/checkout";
import { useCart } from "@/lib/useCart";

/**
 * CART.
 *
 * Cart line items, then the Smart Cart panel, then Bill details — the panel
 * sits at the one screen no user can skip, between the basket and the bill.
 *
 * **The panel's position is load-bearing and did not move in Phase 10.** The
 * page grew from four sections to fourteen to reproduce a real Blinkit
 * checkout, and the temptation in that rewrite is to let the deliverable drift
 * down the scroll among the donation and tip blocks. It stays welded to the
 * basket, in the same card, as the first thing after the items — everything
 * added in Phase 10 sits either above the basket or below the bill.
 *
 * The one section that could have competed with it is "You might also like",
 * and it cannot: it draws only from tiles already in the cart, which is the
 * exact set the panel excludes (D1a). See `checkout.ts`.
 *
 * Reachable directly by URL with an empty cart (no minimum-cart-size gate, per
 * idea doc §5), so the empty state is handled rather than left to crash. The
 * panel is not rendered over an empty cart: "no minimum" means one item rather
 * than two, not zero.
 */
function CartHeader() {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-hairline)] bg-[var(--color-surface)] px-2 py-3">
      <Link href="/" aria-label="Back to home" className="rounded-lg p-2 text-[var(--color-ink)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <h1 className="flex-1 text-[16px] font-bold text-[var(--color-ink)]">Checkout</h1>

      {/* Search is real and goes to the search page; Share has nothing behind it. */}
      <Link href="/search" aria-label="Search products" className="rounded-lg p-2 text-[var(--color-ink)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </Link>
      <span
        className="mr-1 flex items-center gap-1 rounded-full border border-[var(--color-hairline)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-ink)]"
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" strokeLinecap="round" />
          <path d="M12 15V3m0 0L8 7m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Share
      </span>
    </div>
  );
}

function DeliveryCard({ itemCount }: { itemCount: number }) {
  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-[var(--color-hairline)] px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-green)" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div>
        <p className="text-[13px] leading-tight font-bold">Delivery in 8 minutes</p>
        <p className="text-[11px] leading-tight text-[var(--color-ink-muted)]">
          Shipment of {itemCount} item{itemCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

function DeliveryAddress() {
  return (
    <div className="mx-3 mt-2 mb-4 flex items-center gap-3 rounded-xl border border-[var(--color-hairline)] px-3 py-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-brand-yellow-dark)" className="shrink-0" aria-hidden>
        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-tight font-semibold">Delivering to Home</p>
        <p className="clamp-1 text-[11px] leading-tight text-[var(--color-ink-muted)]">
          Indiranagar, Bengaluru
        </p>
      </div>
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
  const { lines, itemCount } = useCart();

  // Per-checkout choices, not persisted: a donation is a decision about this
  // order, and `sc_*` storage is for state that must survive a reload.
  const [donation, setDonation] = useState(0);
  const [tip, setTip] = useState(0);

  const bill = computeBill(lines, { donation, tip });

  if (lines.length === 0) {
    return (
      <main className="flex flex-1 flex-col">
        <CartHeader />
        <EmptyCart />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-[var(--color-surface-sunken)] pb-3">
      <CartHeader />

      <SpecialDeal lines={lines} />
      <DeliveryCard itemCount={itemCount} />

      {/*
        One block. The cart lines and the Smart Cart panel share a single card,
        with no padding between them — the panel is the continuation of the
        basket, not a second surface laid over it. The panel supplies its own
        bottom corners, so the card needs no vertical padding of its own.
      */}
      <div className="mx-3 mt-3 rounded-xl bg-[var(--color-surface)]">
        <ul className="flex flex-col gap-4 px-3 py-3">
          {lines.map((line) => (
            <CartLine key={line.productId} productId={line.productId} quantity={line.quantity} />
          ))}
        </ul>

        <SmartCartPanel />
      </div>

      <UseCoupons />

      <div className="mx-3 mt-3 rounded-xl bg-[var(--color-surface)]">
        <BillDetails bill={bill} />
      </div>

      {/*
        Everything below the bill. "You might also like" leads, because it is
        the one section here a user might act on — the rest is trust chrome.
      */}
      <YouMightAlsoLike lines={lines} />
      <AddGstin />
      <DeliveryInstructions />
      <DonationCard amount={donation} onChange={setDonation} />
      <TipCard amount={tip} onChange={setTip} />
      <GiftPackaging />
      <CancellationPolicy />

      <DeliveryAddress />

      <PlaceOrderBar total={bill.grandTotal} />
    </main>
  );
}
