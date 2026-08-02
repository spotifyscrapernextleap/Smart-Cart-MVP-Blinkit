"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MIN_QUERY_LENGTH } from "@/lib/search";

/**
 * The only interactive element on Home.
 *
 * Search is the sole entry path by design — category tiles are rendered but
 * inert. Submitting navigates to /search?q=… rather than filtering in place, so
 * a query is a shareable URL and the back button behaves.
 */
export default function SearchBar({
  initialQuery = "",
  autoFocus = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} role="search" className="px-4 py-3">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-sunken)] px-3 py-2.5">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 text-[var(--color-ink-muted)]"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          name="q"
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          placeholder='Search "milk" or "atta"'
          aria-label="Search products"
          enterKeyHint="search"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--color-ink-faint)]"
        />
        {/*
          Implicit submission on Enter is only guaranteed when a form has a
          submit control. Keeping one here — visually hidden, still focusable —
          means the mobile keyboard's search key and a hardware Enter both work.
        */}
        <button type="submit" className="sr-only">
          Search
        </button>
      </div>
    </form>
  );
}
