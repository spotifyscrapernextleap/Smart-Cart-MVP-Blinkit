"use client";

import { TIP_OPTIONS } from "@/lib/config";

/**
 * "Tip your delivery partner".
 *
 * Interactive for the same reason as the donation block — it adds a real line
 * to the bill and moves the total. "Custom" is inert: it opens a numeric entry
 * in the real app, and a fake input that accepts a number and discards it
 * would be worse than a chip that visibly does nothing.
 */
const TIP_EMOJI = ["😄", "🤩", "😍"];

export default function TipCard({
  amount,
  onChange,
}: {
  amount: number;
  onChange: (amount: number) => void;
}) {
  return (
    <section className="mx-3 mt-3 rounded-xl bg-[var(--color-surface)] px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
            Tip your delivery partner
          </h2>
          <p className="mt-0.5 text-[11px] leading-tight text-[var(--color-ink-muted)]">
            Your kindness means a lot! 100% of your tip will go directly to your delivery partner.
          </p>
        </div>
        <span className="shrink-0 text-[26px]" aria-hidden>
          🛵
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        {TIP_OPTIONS.map((option, i) => {
          const selected = amount === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(selected ? 0 : option)}
              aria-pressed={selected}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-[13px] font-semibold transition-colors ${
                selected
                  ? "border-[var(--color-brand-green)] bg-[#eef7ef] text-[var(--color-brand-green)]"
                  : "border-[var(--color-hairline)] text-[var(--color-ink)]"
              }`}
            >
              <span aria-hidden>{TIP_EMOJI[i]}</span> ₹{option}
            </button>
          );
        })}
        <span
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--color-hairline)] py-2 text-[13px] font-semibold text-[var(--color-ink)]"
          aria-hidden
        >
          👏 Custom
        </span>
      </div>
    </section>
  );
}
