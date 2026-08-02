import { getSections, getTileThumbnail } from "@/lib/catalogue";

import ProductImage from "./ProductImage";

/**
 * Category tiles grouped by section, four per row.
 *
 * **No tile is clickable in v1.** Search is the only entry path, and browse
 * navigation is explicitly deferred. The grid exists so the home screen reads as
 * Blinkit rather than as a search box on a white page.
 *
 * The dimming rule is retained from build spec 2.2 — tiles whose `searchable` is
 * false render at 40% opacity. After decision D12 every tile is searchable, so
 * nothing currently dims; the branch stays so that flipping a tile back in
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
              return (
                <li
                  key={tile.id}
                  className={
                    tile.searchable
                      ? ""
                      : "pointer-events-none opacity-40"
                  }
                  aria-disabled={!tile.searchable || undefined}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--color-surface-sunken)]">
                      {thumbnail ? (
                        <ProductImage
                          src={thumbnail}
                          alt={tile.label}
                          className="h-full w-full"
                        />
                      ) : null}
                    </div>
                    <span className="clamp-2 text-center text-[11px] leading-tight text-[var(--color-ink-muted)]">
                      {tile.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
