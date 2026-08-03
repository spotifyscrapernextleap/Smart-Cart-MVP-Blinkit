import Link from "next/link";
import { notFound } from "next/navigation";

import ProductCard from "@/components/ProductCard";
import ViewCartBar from "@/components/ViewCartBar";
import { getProductsByTile, getTile } from "@/lib/catalogue";
import { BROWSABLE_TILES } from "@/lib/config";

/**
 * A full category listing. (PROJECT_MEMORY D37)
 *
 * The build spec defers browse navigation, so this route is an addition to it —
 * the reasoning is D37. Only the tiles in `BROWSABLE_TILES` resolve; anything
 * else 404s rather than rendering an unreachable page, because a category the
 * home screen does not link to is not a page this app has.
 *
 * A server component. The catalogue is a static import resolved at build, so
 * every one of these prerenders to HTML with no request-time work — the same
 * reason `/` and `/search` are static. Only `ProductCard` is a client
 * component, because only the ADD control needs the cart.
 */

export function generateStaticParams() {
  return BROWSABLE_TILES.map((tile) => ({ tile }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tile: string }>;
}) {
  const { tile } = await params;
  const label = getTile(tile)?.label;
  return { title: label ? `${label} — Blinkit` : "Blinkit — Smart Cart" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ tile: string }>;
}) {
  const { tile: tileId } = await params;

  const tile = getTile(tileId);
  if (!tile || !BROWSABLE_TILES.includes(tileId)) notFound();

  // Already in bestseller order — catalogue.ts sorts each tile's bucket once at
  // module load, so the listing leads with the same products the panel would.
  const products = getProductsByTile(tileId);

  return (
    <main className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-[var(--color-hairline)] bg-[var(--color-surface)] px-2 py-2">
        <Link
          href="/"
          aria-label="Back to home"
          className="shrink-0 rounded-lg p-2 text-[var(--color-ink)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="clamp-1 text-[15px] leading-tight font-bold text-[var(--color-ink)]">
            {tile.label}
          </h1>
          <p className="text-[11px] leading-tight text-[var(--color-ink-muted)]">
            {tile.section}
          </p>
        </div>
      </div>

      <p className="px-4 pt-3 pb-1 text-[12px] text-[var(--color-ink-muted)]">
        {products.length} product{products.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-2.5 px-4 pt-2 pb-8">
        {products.map((product) => (
          <li key={product.id} className="flex">
            {/* source="category": a browse is not a search, and attributing it
                as one would inflate search's conversions. (D37) */}
            <ProductCard product={product} source="category" />
          </li>
        ))}
      </ul>

      <ViewCartBar />
    </main>
  );
}
