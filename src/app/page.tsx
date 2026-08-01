"use client";

import { useEffect, useState } from "react";

import { STORAGE_KEYS } from "@/lib/storage";

/**
 * Phase 1 shell. Replaced by the Home screen in Phase 2.
 *
 * It renders the current session and which storage keys are populated, purely
 * so the `?reset=1` behaviour is observable without opening devtools.
 */
export default function Page() {
  const [snapshot, setSnapshot] = useState<
    { session: string; keys: [string, boolean][] } | null
  >(null);

  useEffect(() => {
    // Read after AppBootstrap's effect has run, never during render.
    const read = () => {
      let session = "—";
      try {
        session = window.localStorage.getItem(STORAGE_KEYS.session) ?? "—";
      } catch {
        session = "(localStorage unavailable)";
      }
      setSnapshot({
        session,
        keys: Object.values(STORAGE_KEYS).map((key) => {
          try {
            return [key, window.localStorage.getItem(key) !== null];
          } catch {
            return [key, false];
          }
        }),
      });
    };
    const timer = window.setTimeout(read, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-4 p-5">
      <header>
        <h1 className="text-lg font-semibold">Smart Cart</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Phase 1 shell — Home lands in Phase 2.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--color-hairline)] p-4">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
          Session
        </h2>
        <p className="font-mono text-xs break-all">
          {snapshot ? snapshot.session : "reading…"}
        </p>
      </section>

      <section className="rounded-xl border border-[var(--color-hairline)] p-4">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
          Storage keys
        </h2>
        <ul className="space-y-1 font-mono text-xs">
          {snapshot?.keys.map(([key, present]) => (
            <li key={key} className="flex justify-between">
              <span>{key}</span>
              <span
                className={
                  present
                    ? "text-[var(--color-brand-green)]"
                    : "text-[var(--color-ink-faint)]"
                }
              >
                {present ? "set" : "empty"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <a
        href="/?reset=1"
        className="rounded-lg bg-[var(--color-surface-sunken)] px-4 py-2 text-center text-sm font-medium"
      >
        Test ?reset=1
      </a>
    </main>
  );
}
