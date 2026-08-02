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
    <section className="border-t border-[var(--color-hairline)] px-4 py-4">
      <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
        Bill details
      </h2>
      <div className="flex items-center justify-between text-[14px] text-[var(--color-ink)]">
        <span>Item total</span>
        <span>₹{subtotal}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-[var(--color-hairline)] pt-3 text-[15px] font-bold">
        <span>To pay</span>
        <span>₹{subtotal}</span>
      </div>
    </section>
  );
}
