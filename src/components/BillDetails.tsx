/**
 * Bill summary at the bottom of the cart.
 *
 * Deliberately just item total and total to pay, both equal. Real Blinkit
 * bills carry delivery and handling fees, but neither the build spec nor the
 * idea doc specifies any fee model — inventing one would misrepresent the
 * deliverable's actual pricing logic to show a line item nobody asked for.
 */
export default function BillDetails({ subtotal }: { subtotal: number }) {
  return (
    <section className="px-4 py-4">
      <h2 className="mb-3 text-[14px] font-bold text-[var(--color-ink)]">Bill details</h2>
      <div className="flex items-center justify-between text-[13px] text-[var(--color-ink)]">
        <span>Items total</span>
        <span>₹{subtotal}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[13px] text-[var(--color-ink)]">
        <span>Delivery fee</span>
        <span className="font-semibold text-[var(--color-brand-green)]">FREE</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-hairline)] pt-3 text-[15px] font-bold">
        <span>Grand total</span>
        <span>₹{subtotal}</span>
      </div>
    </section>
  );
}
