import type { Bill } from "@/lib/checkout";

/**
 * Bill summary at the bottom of the cart.
 *
 * Arithmetic is not done here — it arrives as a `Bill` from `checkout.ts`, so
 * this component and `PlaceOrderBar` cannot disagree about the total. All this
 * file decides is what to show and when to hide it.
 *
 * Three lines are conditional, because a row reading ₹0 is noise: item savings
 * only appear when something in the cart is actually discounted, and the
 * donation and tip lines only once the user has chosen one.
 *
 * The dotted underlines mirror Blinkit's tap-for-explanation affordance. They
 * are decoration here — there is no tooltip behind them — which is why they
 * are styling on a `<span>` and not a control.
 */
function Line({
  label,
  children,
  dotted = false,
}: {
  label: string;
  children: React.ReactNode;
  dotted?: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-between text-[13px] text-[var(--color-ink)]">
      <span className={dotted ? "border-b border-dotted border-[var(--color-ink-faint)]" : undefined}>
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">{children}</span>
    </div>
  );
}

export default function BillDetails({ bill }: { bill: Bill }) {
  return (
    <section className="px-4 pt-4 pb-5">
      <h2 className="mb-1 text-[14px] font-bold text-[var(--color-ink)]">Bill details</h2>

      <div className="mt-2 flex items-center justify-between text-[13px] text-[var(--color-ink)]">
        <span className="flex items-center gap-2">
          Items total
          {bill.itemsSaved > 0 && (
            <span className="rounded bg-[#eaf2ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1f66d0]">
              Saved ₹{bill.itemsSaved}
            </span>
          )}
        </span>
        <span className="flex items-baseline gap-1.5">
          {bill.itemsSaved > 0 && (
            <span className="text-[11px] text-[var(--color-ink-faint)] line-through">
              ₹{bill.itemsMrpTotal}
            </span>
          )}
          <span>₹{bill.itemsTotal}</span>
        </span>
      </div>

      {bill.donation > 0 && <Line label="Feeding India donation">₹{bill.donation}</Line>}
      {bill.tip > 0 && <Line label="Delivery partner tip">₹{bill.tip}</Line>}

      <Line label="Delivery charge" dotted>
        <span className="text-[11px] text-[var(--color-ink-faint)] line-through">
          ₹{bill.deliveryFeeOriginal}
        </span>
        <span className="font-semibold text-[#1f66d0]">FREE</span>
      </Line>

      <Line label="Handling charge" dotted>
        ₹{bill.handlingCharge}
      </Line>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-hairline)] pt-3 text-[15px] font-bold">
        <span className="border-b border-dotted border-[var(--color-ink-faint)]">Grand total</span>
        <span>₹{bill.grandTotal}</span>
      </div>

      <div className="mt-3 rounded-lg bg-[#eaf2ff] px-3 py-2">
        <div className="flex items-center justify-between text-[12px] font-bold text-[#1f66d0]">
          <span>Your total savings</span>
          <span>₹{bill.totalSavings}</span>
        </div>
        <p className="mt-0.5 text-[10px] text-[#1f66d0]">
          Includes ₹{bill.deliveryFeeOriginal} savings through free delivery
        </p>
      </div>
    </section>
  );
}
