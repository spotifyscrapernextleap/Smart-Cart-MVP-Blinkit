/**
 * Cart: add, remove, setQuantity, subtotal, cartSignature. (Build spec §6, 3.1)
 *
 * Always reads through to storage rather than caching in the module — the cart
 * must reflect whatever is actually on disk, including a catalogue that was
 * rebuilt since the cart was last written. Every read re-sanitises:
 *
 *   - drops any productId no longer in the catalogue, and heals storage in
 *     place. Product ids are positional and shift on a catalogue rebuild, so a
 *     stale id left unresolved would crash the cart page on `.price`. (EDGE_CASES C2)
 *   - clamps quantity to an integer in [1, 99] and merges duplicate lines for
 *     the same product, dropping anything that clamps to zero. (EDGE_CASES C5)
 */

import { getProduct, hasProduct } from "./catalogue.ts";
import { MAX_CART_QUANTITY, MIN_CART_QUANTITY } from "./config.ts";
import { STORAGE_KEYS, getItem, isCartLines, setItem } from "./storage.ts";
import type { CartLine, CartSignature, ProductId } from "./types";

// ---------------------------------------------------------------------------
// Sanitisation
// ---------------------------------------------------------------------------

function clampQuantity(raw: number): number {
  const whole = Math.floor(raw);
  if (!Number.isFinite(whole)) return 0;
  return Math.min(MAX_CART_QUANTITY, Math.max(0, whole));
}

function sanitise(raw: CartLine[]): CartLine[] {
  const merged = new Map<ProductId, number>();
  for (const line of raw) {
    if (!hasProduct(line.productId)) continue; // (EDGE_CASES C2)
    const quantity = clampQuantity(line.quantity);
    if (quantity <= 0) continue; // (EDGE_CASES C5)
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + quantity);
  }
  return [...merged.entries()].map(([productId, quantity]) => ({
    productId,
    quantity: Math.min(MAX_CART_QUANTITY, quantity),
  }));
}

// ---------------------------------------------------------------------------
// Subscription
//
// No state library — a plain listener set, notified after every write. React
// components subscribe through useCart()/useCartQuantity() in useCart.ts.
// ---------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeCart(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getCart(): CartLine[] {
  const raw = getItem<CartLine[]>(STORAGE_KEYS.cart, [], isCartLines);
  const clean = sanitise(raw);
  if (JSON.stringify(clean) !== JSON.stringify(raw)) {
    // Heal silently. This is not itself a user action, so it does not notify.
    setItem(STORAGE_KEYS.cart, clean);
  }
  return clean;
}

// ---------------------------------------------------------------------------
// React snapshot
//
// useSyncExternalStore requires getSnapshot to return a referentially stable
// value when nothing has changed, or it re-renders every time. getCart() above
// re-sanitises on every call and cannot give that guarantee cheaply, so this
// wraps it with a cache keyed on the serialised value: a new array reference is
// only produced when the cart's actual contents differ from last time.
// ---------------------------------------------------------------------------

let snapshotLines: CartLine[] = [];
let snapshotKey = "";

export function getCartSnapshot(): CartLine[] {
  const clean = getCart();
  const key = JSON.stringify(clean);
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshotLines = clean;
  }
  return snapshotLines;
}

export function getQuantity(productId: ProductId): number {
  return getCart().find((line) => line.productId === productId)?.quantity ?? 0;
}

export function getItemCount(): number {
  return getCart().reduce((sum, line) => sum + line.quantity, 0);
}

export function getSubtotal(): number {
  return getCart().reduce((sum, line) => {
    const product = getProduct(line.productId);
    return product ? sum + product.price * line.quantity : sum;
  }, 0);
}

/**
 * Sorted product ids joined with their quantities, e.g. "p_00412:2|p_00877:1".
 * The identity of the cart, and the key the Smart Cart panel is cached against.
 * (Build spec §4, Step 1)
 */
export function cartSignature(): CartSignature {
  return [...getCart()]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((line) => `${line.productId}:${line.quantity}`)
    .join("|");
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function writeCart(lines: CartLine[]): void {
  setItem(STORAGE_KEYS.cart, lines);
  notify();
}

export function addToCart(productId: ProductId, quantity = 1): void {
  if (!hasProduct(productId)) return;
  const lines = getCart();
  const index = lines.findIndex((line) => line.productId === productId);

  const next =
    index >= 0
      ? lines.map((line, i) =>
          i === index
            ? { ...line, quantity: Math.min(MAX_CART_QUANTITY, line.quantity + quantity) }
            : line
        )
      : [
          ...lines,
          {
            productId,
            quantity: Math.min(MAX_CART_QUANTITY, Math.max(MIN_CART_QUANTITY, Math.floor(quantity))),
          },
        ];

  writeCart(next);
}

export function removeFromCart(productId: ProductId): void {
  writeCart(getCart().filter((line) => line.productId !== productId));
}

/** Quantity 0 or below removes the line. Setting a product not in the cart is a no-op. */
export function setQuantity(productId: ProductId, quantity: number): void {
  const clamped = clampQuantity(quantity);
  if (clamped <= 0) {
    removeFromCart(productId);
    return;
  }
  const lines = getCart();
  if (!lines.some((line) => line.productId === productId)) return;
  writeCart(
    lines.map((line) => (line.productId === productId ? { ...line, quantity: clamped } : line))
  );
}
