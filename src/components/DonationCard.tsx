"use client";

import { DONATION_MEAL_AMOUNT, DONATION_OPTIONS } from "@/lib/config";

/**
 * "You are feeding India" — the donation block.
 *
 * Genuinely wired to the bill rather than decorative: picking an amount adds a
 * line to Bill details and moves the Place Order total. That is the whole
 * reason it is interactive — a chip that highlights but changes no number is
 * the kind of detail that makes a demo feel hollow on the second tap.
 *
 * State lives in the cart page, not here, because Bill details and the Place
 * Order bar both need to read it. Nothing is persisted: a donation is a
 * per-checkout choice, and `sc_*` storage is for things that must survive a
 * reload.
 */
export default function DonationCard({
  amount,
  onChange,
}: {
  amount: number;
  onChange: (amount: number) => void;
}) {
  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-xl bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-2 bg-[#dcefff] px-4 py-3">
        <div>
          <p className="flex items-center gap-1 text-[14px] font-bold text-[var(--color-ink)]">
            You are feeding India
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-ink)] text-[9px] text-white">
              ›
            </span>
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-[var(--color-ink-muted)]">
            Behind a curious child,
            <br />
            is a quiet force like you
          </p>
        </div>
        <span className="text-[26px]" aria-hidden>
          🪁
        </span>
      </div>

      <div className="px-4 py-3">
        <p className="mb-2.5 text-[12px] text-[var(--color-ink-muted)]">
          Donate with <span className="font-semibold text-[var(--color-ink)] underline">every order</span>
        </p>

        <div className="flex gap-2">
          {DONATION_OPTIONS.map((option) => {
            const selected = amount === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(selected ? 0 : option)}
                aria-pressed={selected}
                className={`relative flex-1 rounded-lg border py-2.5 text-[14px] font-semibold transition-colors ${
                  selected
                    ? "border-[var(--color-brand-green)] bg-[#eef7ef] text-[var(--color-brand-green)]"
                    : "border-[var(--color-hairline)] text-[var(--color-ink)]"
                }`}
              >
                {option === DONATION_MEAL_AMOUNT && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-[#eef7ef] px-1 text-[8px] font-bold tracking-wide text-[var(--color-brand-green)]">
                    1 MEAL
                  </span>
                )}
                ₹{option}
              </button>
            );
          })}
        </div>

        {amount > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              <span className="text-[var(--color-brand-green)]">✓</span> Amount added to your order
            </p>
            <button
              type="button"
              onClick={() => onChange(0)}
              className="text-[12px] font-bold text-[var(--color-brand-green)]"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
