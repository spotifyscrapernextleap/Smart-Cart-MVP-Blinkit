"use client";

/**
 * React bindings for cart.ts, via useSyncExternalStore — the primitive React
 * provides specifically for reading a mutable external source (here,
 * localStorage through cart.ts) safely under concurrent rendering and without
 * a server/client mismatch. Not any state library, per the build spec's
 * "explicitly not used" list; this is a React built-in.
 *
 * The server snapshot is always an empty cart/zero, matching what the first
 * client render must also show before the real value is read — the same
 * SSR-safety guarantee as the rest of the storage layer. (EDGE_CASES C1)
 *
 * Two hooks, not one: a card in a 40-result grid only needs its own quantity —
 * a plain number, stable by value with no caching required — not the whole
 * cart recomputed on every mutation anywhere on the page.
 */

import { useSyncExternalStore } from "react";

import { getCartSnapshot, getQuantity, subscribeCart } from "./cart.ts";
import { getProduct } from "./catalogue.ts";
import type { CartLine, ProductId } from "./types";

const EMPTY_LINES: CartLine[] = [];

function getServerLines(): CartLine[] {
  return EMPTY_LINES;
}

export function useCart() {
  const lines = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerLines);

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => {
    const product = getProduct(line.productId);
    return product ? sum + product.price * line.quantity : sum;
  }, 0);

  return { lines, itemCount, subtotal };
}

function getServerQuantity(): number {
  return 0;
}

export function useCartQuantity(productId: ProductId): number {
  return useSyncExternalStore(
    subscribeCart,
    () => getQuantity(productId),
    getServerQuantity
  );
}
