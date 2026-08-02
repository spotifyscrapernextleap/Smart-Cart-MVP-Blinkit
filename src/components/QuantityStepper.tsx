"use client";

/**
 * ADD button that becomes a "− qty +" stepper once a product is in the cart.
 *
 * Shared by ProductCard and CartLine, which need byte-identical behaviour: at
 * quantity 0 show a plain ADD control; above 0, decrementing from 1 removes the
 * line rather than showing a 0. There is no separate "dismiss" concept here —
 * unlike the Smart Cart panel's stepper/dismiss overload (idea doc §7, fixed in
 * Phase 5), a quantity of 0 in a real cart genuinely means "not in the cart",
 * so collapsing decrement-to-zero into removal is correct, not an overload.
 */
export default function QuantityStepper({
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
  label,
  tone = "green",
  disabled = false,
}: {
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Product name, for the +/- aria-labels. */
  label: string;
  /** Green in the real cart, violet in the Smart Cart panel. */
  tone?: "green" | "violet";
  disabled?: boolean;
}) {
  const accent =
    tone === "violet" ? "var(--color-panel-accent)" : "var(--color-brand-green)";

  if (quantity <= 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        style={{ borderColor: accent, color: accent }}
        className="rounded-lg border px-3.5 py-1 text-[13px] font-bold disabled:opacity-50"
      >
        ADD
      </button>
    );
  }

  return (
    <div
      style={{ backgroundColor: accent }}
      className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-white"
    >
      <button
        type="button"
        onClick={onDecrement}
        aria-label={`Remove one ${label}`}
        className="px-1 text-[15px] leading-none font-bold"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-[1ch] text-center text-[13px] font-bold">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label={`Add one more ${label}`}
        className="px-1 text-[15px] leading-none font-bold"
      >
        +
      </button>
    </div>
  );
}
