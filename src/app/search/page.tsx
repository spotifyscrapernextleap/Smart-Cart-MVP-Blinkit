"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import { logEvent } from "@/lib/events";
import { search } from "@/lib/search";

/** Longest query echoed back into the UI. (EDGE_CASES B6) */
const MAX_ECHOED_QUERY = 60;

function BackBar({ query }: { query: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-[var(--color-hairline)] bg-[var(--color-surface)] pl-2">
      <Link
        href="/"
        aria-label="Back to home"
        className="shrink-0 rounded-lg p-2 text-[var(--color-ink)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <div className="flex-1">
        <SearchBar initialQuery={query} />
      </div>
    </div>
  );
}

function SearchResults() {
  const params = useSearchParams();
  const rawQuery = params.get("q") ?? "";

  const outcome = useMemo(() => search(rawQuery), [rawQuery]);

  // Logged per resolved query, not per keystroke — the query only changes on
  // submit, because search navigates rather than filtering in place.
  useEffect(() => {
    if (outcome.tooShort) return;
    logEvent("search", {
      query: outcome.query,
      resultCount: outcome.results.length,
    });
  }, [outcome]);

  const echoed =
    outcome.query.length > MAX_ECHOED_QUERY
      ? `${outcome.query.slice(0, MAX_ECHOED_QUERY)}…`
      : outcome.query;

  return (
    <main className="flex flex-1 flex-col">
      <BackBar query={rawQuery} />

      {outcome.tooShort ? (
        <EmptyState
          title="Type at least two characters"
          body="Try a product, a brand, or a category."
        />
      ) : outcome.empty ? (
        <EmptyState
          title="Not available here"
          body={`We could not find anything matching “${echoed}”. Try a different product or brand.`}
        />
      ) : (
        <>
          <p className="px-4 pt-3 pb-1 text-[12px] text-[var(--color-ink-muted)]">
            {outcome.results.length}
            {outcome.capped ? "+" : ""} result
            {outcome.results.length === 1 ? "" : "s"} for “{echoed}”
          </p>
          <ul className="grid grid-cols-2 gap-2.5 px-4 pt-2 pb-8">
            {outcome.results.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-16 text-center">
      <p className="text-[15px] font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
        {body}
      </p>
    </div>
  );
}

export default function SearchPage() {
  // useSearchParams needs a Suspense boundary, or the whole route opts out of
  // static rendering.
  return (
    <Suspense fallback={<div className="p-4 text-sm text-[var(--color-ink-muted)]">Loading…</div>}>
      <SearchResults />
    </Suspense>
  );
}
