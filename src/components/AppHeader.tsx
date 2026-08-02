/**
 * The Blinkit-style header: delivery promise and a location line.
 *
 * Static. There is one hardcoded user and no address book — the location exists
 * because its absence is the first thing that reads as "not a real app".
 */
export default function AppHeader() {
  return (
    <header className="bg-[var(--color-brand-yellow)] px-4 pt-4 pb-3">
      <p className="text-[13px] leading-tight font-bold text-[var(--color-ink)]">
        Blinkit in
      </p>
      <p className="text-[22px] leading-tight font-extrabold text-[var(--color-ink)]">
        23 minutes
      </p>
      <div className="mt-1 flex items-center gap-1 text-[13px] text-[var(--color-ink)]/80">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
        </svg>
        <span className="truncate">HOME - Indiranagar, Bengaluru</span>
      </div>
    </header>
  );
}
