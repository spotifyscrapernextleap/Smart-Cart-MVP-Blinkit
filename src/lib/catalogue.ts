/**
 * Catalogue and tile access.
 *
 * The seed files are static imports, resolved at build. There is no fetch, no
 * filesystem read and no database — 2,236 products is a file, and a hosted store
 * would add an idle-pause failure mode on the day the demo is graded.
 *
 * This module is imported by both the client (search runs in the browser) and
 * the server (the recommend route). Keep it free of anything environment-specific.
 */

// Relative, with an explicit import attribute, so this module resolves under
// both the Next bundler and bare `node` — which is what lets the phase tests run
// against real source with no test-runner dependency.
import catalogueJson from "../../data/catalogue.json" with { type: "json" };
import tilesJson from "../../data/tiles.json" with { type: "json" };

import type { Product, ProductId, Tile, TileId } from "./types";

export const products = catalogueJson as Product[];
export const tiles = tilesJson as Tile[];

const productById = new Map<ProductId, Product>(products.map((p) => [p.id, p]));
const tileById = new Map<TileId, Tile>(tiles.map((t) => [t.id, t]));

const productsByTile = new Map<TileId, Product[]>();
for (const product of products) {
  const bucket = productsByTile.get(product.tile);
  if (bucket) bucket.push(product);
  else productsByTile.set(product.tile, [product]);
}
// Ranked once here rather than at every call site. Every consumer — shortlists,
// the fallback panel, Browse & Replace — wants bestseller order.
for (const bucket of productsByTile.values()) {
  bucket.sort((a, b) => a.bestsellerRank - b.bestsellerRank);
}

export function getProduct(id: ProductId): Product | undefined {
  return productById.get(id);
}

/**
 * Resolves ids to products, silently dropping any that are unknown.
 *
 * Product ids are positional and shift whenever the catalogue is rebuilt, so
 * anything persisted in localStorage can outlive the products it names. Callers
 * that read stored ids must go through here. (EDGE_CASES C2)
 */
export function getProducts(ids: ProductId[]): Product[] {
  const found: Product[] = [];
  for (const id of ids) {
    const product = productById.get(id);
    if (product) found.push(product);
  }
  return found;
}

export function hasProduct(id: ProductId): boolean {
  return productById.has(id);
}

/** Products in a tile, in bestseller order. */
export function getProductsByTile(tileId: TileId): Product[] {
  return productsByTile.get(tileId) ?? [];
}

export function getTile(id: TileId): Tile | undefined {
  return tileById.get(id);
}

/** Tile label for display and for reason lines, e.g. "Pet Store". */
export function getTileLabel(id: TileId): string {
  return tileById.get(id)?.label ?? id;
}

export interface Section {
  name: string;
  tiles: Tile[];
}

/**
 * Tiles grouped by section, in the order they appear in tiles.json.
 * Section order is a display decision and lives in the data, not here.
 */
export function getSections(): Section[] {
  const sections: Section[] = [];
  const indexByName = new Map<string, number>();
  for (const tile of tiles) {
    const at = indexByName.get(tile.section);
    if (at === undefined) {
      indexByName.set(tile.section, sections.length);
      sections.push({ name: tile.section, tiles: [tile] });
    } else {
      sections[at].tiles.push(tile);
    }
  }
  return sections;
}

/**
 * The image shown for a tile on the home screen: its top-ranked product.
 * Avoids shipping a second set of artwork for something that is decorative.
 */
export function getTileThumbnail(tileId: TileId): string | undefined {
  return getProductsByTile(tileId)[0]?.imagePath;
}
