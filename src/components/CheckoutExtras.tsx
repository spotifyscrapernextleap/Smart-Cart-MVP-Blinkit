/**
 * The static chrome of a real Blinkit checkout: coupons, GSTIN, delivery
 * instructions, gift packaging, cancellation policy.
 *
 * All of it is presentational. None of these has behaviour behind it in this
 * build, and rather than wire up controls that silently discard input, the
 * rows render as non-interactive blocks — no `<button>`, no `<a>`, nothing
 * focusable, `aria-hidden` on the chevrons. They exist so the page reads as a
 * real checkout around the one section that is real.
 *
 * The delivery-instruction checkboxes are the one place this is a judgement
 * call: they are drawn in their unchecked state and cannot be checked. A
 * checkbox that toggles but is never read would look more finished and be less
 * honest about what this build does.
 */

function Row({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-[var(--color-surface)] px-4 py-3.5">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-[var(--color-ink)]">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] leading-tight text-[var(--color-ink-muted)]">{subtitle}</p>
        )}
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-ink-faint)"
        strokeWidth="2"
        className="shrink-0"
        aria-hidden
      >
        <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const couponIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1f66d0" aria-hidden>
    <path d="M12 2 9.8 4.2 6.8 3.6 6.2 6.6 3.6 8.2 5 10.9 3.6 13.6l2.6 1.6.6 3 3-.6L12 20l2.2-2.2 3 .6.6-3 2.6-1.6-1.4-2.7 1.4-2.7-2.6-1.6-.6-3-3 .6z" />
  </svg>
);

const gstIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1f66d0" aria-hidden>
    <path d="M4 4h16v16H4z" opacity=".15" />
    <path d="M20 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Zm-1 16H5V5h14Z" />
    <path d="M8.5 8.5h7v1.5h-7zm0 3.5h7v1.5h-7zm0 3.5h4V17h-4z" />
  </svg>
);

export function UseCoupons() {
  return <Row icon={couponIcon} title="Use Coupons" />;
}

export function AddGstin() {
  return (
    <Row
      icon={gstIcon}
      title="Add GSTIN"
      subtitle="Claim GST input credit up to 18% on your order"
    />
  );
}

export function DeliveryInstructions() {
  const options = [
    {
      label: "Press here and hold",
      head: (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-brand-green)]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3v14l5-5 1.4 1.4L12 20l-6.4-6.6L7 12l5 5V3z" />
          </svg>
          Record
        </span>
      ),
    },
    { label: "Avoid calling", head: null, checkbox: true },
    { label: "Don't ring the bell", head: null, checkbox: true },
  ];

  return (
    <section className="mx-3 mt-3 rounded-xl bg-[var(--color-surface)] px-4 py-4">
      <h2 className="mb-3 text-[15px] font-bold text-[var(--color-ink)]">Delivery instructions</h2>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <div
            key={option.label}
            className="flex h-[92px] flex-col justify-between rounded-lg border border-[var(--color-hairline)] p-2"
          >
            <div className="flex items-start justify-between">
              {option.head ?? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="1.6" aria-hidden>
                  <path d="M3 3l18 18M9 4a3 3 0 0 1 6 0v5" strokeLinecap="round" />
                  <path d="M6 10a6 6 0 0 0 9 5" strokeLinecap="round" />
                </svg>
              )}
              {option.checkbox && (
                <span
                  className="h-4 w-4 shrink-0 rounded-sm border-2 border-[var(--color-brand-green)]"
                  aria-hidden
                />
              )}
            </div>
            <p className="text-[11px] leading-tight text-[var(--color-ink)]">{option.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GiftPackaging() {
  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-[var(--color-surface)] px-4 py-3.5">
      <span className="text-[20px]" aria-hidden>
        🎁
      </span>
      <div>
        <p className="text-[14px] font-bold text-[var(--color-ink)]">Gift Packaging</p>
        <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">
          All items in your cart are ineligible for gifting
        </p>
      </div>
    </div>
  );
}

export function CancellationPolicy() {
  return (
    <div className="mx-3 mt-3 rounded-xl bg-[var(--color-surface)] px-4 py-3.5">
      <p className="text-[14px] font-bold text-[var(--color-ink)]">Cancellation Policy</p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--color-ink-muted)]">
        Once order placed, any cancellation may result in a fee. In case of unexpected delays
        leading to order cancellation, a complete refund will be provided.
      </p>
    </div>
  );
}
