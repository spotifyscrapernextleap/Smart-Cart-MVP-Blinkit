import Link from "next/link";

import { getSections, getTileThumbnail } from "@/lib/catalogue";
import { BROWSABLE_TILES } from "@/lib/config";

import ProductImage from "./ProductImage";

/**
 * Category tiles grouped by section, four per row.
 *
 * **Some tiles open a listing; most do not.** The build spec defers browse
 * navigation entirely, and two tiles per section are opened up rather than all
 * 27 — see `BROWSABLE_TILES` and D37.
 *
 * A grid where only some tiles respond is the risk in that, so the two states
 * are made visually distinct rather than left to be discovered by tapping: a
 * browsable tile gets a white card, a border and a chevron on its label; the
 * rest stay flat on the sunken background with no affordance. Nothing is dimmed
 * or disabled-looking, because an inert tile here is scenery, not a broken
 * control.
 *
 * The dimming rule from build spec 2.2 — tiles whose `searchable` is false
 * render at 40% opacity — is retained. After D12 every tile is searchable, so
 * nothing currently dims; the branch stays so flipping a tile back in
 * tiles.json restores the behaviour without a code change.
 */
export default function CategoryGrid() {
  const sections = getSections();

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      {sections.map((section) => (
        <section key={section.name}>
          <h2 className="mb-3 text-[15px] font-bold text-[var(--color-ink)]">
            {section.name}
          </h2>
          <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
            {section.tiles.map((tile) => {
              const thumbnail = getTileThumbnail(tile.id);
              const browsable = BROWSABLE_TILES.includes(tile.id);

              const inner = (
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl ${
                      browsable
                        ? "border border-[var(--color-hairline)] bg-[var(--color-surface)]"
                        : "bg-[var(--color-surface-sunken)]"
                    }`}
                  >
                    {thumbnail ? (
                      <ProductImage
                        src={thumbnail}
                        alt={tile.label}
                        className="h-full w-full"
                      />
                    ) : null}
                  </div>
                  <span
                    className={`clamp-2 text-center text-[11px] leading-tight ${
                      browsable
                        ? "font-semibold text-[var(--color-ink)]"
                        : "text-[var(--color-ink-muted)]"
                    }`}
                  >
                    {tile.label}
                    {browsable ? (
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        aria-hidden
                        className="ml-0.5 inline-block align-baseline"
                      >
                        <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                </div>
              );

              return (
                <li
                  key={tile.id}
                  className={tile.searchable ? "" : "pointer-events-none opacity-40"}
                  aria-disabled={!tile.searchable || undefined}
                >
                  {browsable ? (
                    <Link href={`/category/${tile.id}`} aria-label={`Browse ${tile.label}`}>
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
