/**
 * The sticky checkout footer: payment method and the Place Order CTA.
 *
 * **Deliberately not clickable.** There is no payment integration and no order
 * model in this build, so the button is a `<div>`, not a `<button>` — it has
 * no handler, takes no focus, and announces nothing to a screen reader. A
 * green button that swallows a tap is the single fastest way to make a demo
 * feel broken; one that never claims to be pressable is honest scenery.
 * (Owner's decision, Phase 10.)
 *
 * The total is passed in rather than recomputed, so this bar and Bill details
 * physically cannot disagree — both read the same `Bill`.
 *
 * Bottom padding carries `safe-area-inset-bottom` so the bar clears the iOS
 * home indicator instead of sitting under it, same as `ViewCartBar`. (F8)
 */
export default function PlaceOrderBar({ total }: { total: number }) {
  return (
    <div
      className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 pt-2.5"
      style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
    >
      <div className="shrink-0" aria-hidden>
        <p className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
          <span className="rounded-sm bg-[#00baf2] px-1 py-px text-[8px] font-bold text-white">
            Paytm
          </span>
          PAY USING ▲
        </p>
        <p className="mt-0.5 text-[12px] font-semibold text-[var(--color-ink)]">Paytm UPI</p>
      </div>

      <div
        className="flex flex-1 items-center justify-between rounded-xl bg-[var(--color-brand-green)] px-4 py-2.5 text-white"
        aria-hidden
      >
        <span className="leading-tight">
          <span className="block text-[15px] font-bold">₹{total}</span>
          <span className="block text-[9px] tracking-wide">TOTAL</span>
        </span>
        <span className="flex items-center gap-1 text-[15px] font-bold">
          Place Order
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
