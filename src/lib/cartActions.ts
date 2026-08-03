/**
 * Cart mutations paired with the events that describe them.
 *
 * `cart.ts` changes state and `events.ts` writes the log; neither knows about
 * the other, which is correct — but the *rule* connecting them (D22: log only
 * on the 0↔1 transition) is a single rule, and it was implemented separately at
 * three call sites. One of them drifted: the Smart Cart panel's own row stepper
 * removed a product without logging `cart_remove`, so a product could leave the
 * cart with no event marking it. Phase 8 found it by auditing the call sites
 * against §3.6, which is the whole reason that phase exists.
 *
 * Every control that can add or remove a product now goes through here, so
 * there is one implementation of the rule to be wrong about.
 */

import { addToCart, removeFromCart, setQuantity } from "./cart.ts";
import { logEvent } from "./events.ts";
import type { CartAddSource, Product } from "./types";

/**
 * A product entering the cart. Logs `cart_add` with the surface it came from.
 *
 * Only ever called from a control showing ADD — i.e. at quantity 0 — because
 * `source` is an attribution of how the product got in, and re-logging it on a
 * later "+" would count a quantity bump as a fresh conversion. (D22)
 */
export function addProduct(product: Product, source: CartAddSource): void {
  addToCart(product.id, 1);
  logEvent("cart_add", { productId: product.id, tile: product.tile, source });
}

/**
 * A quantity bump on a product already in the cart.
 *
 * Deliberately logs nothing. This function exists rather than a bare
 * `addToCart` call so that the absence of an event is a stated decision at the
 * place someone would otherwise be tempted to add one. (D22)
 */
export function incrementProduct(product: Product): void {
  addToCart(product.id, 1);
}

/**
 * A decrement, which becomes a removal at quantity 1.
 *
 * Logs `cart_remove` only on the transition to zero — the moment the product
 * leaves the cart — whichever control triggered it: the search card, the cart
 * line, or the panel row during its exit animation. (D22)
 */
export function decrementProduct(product: Product, quantity: number): void {
  if (quantity <= 1) {
    removeFromCart(product.id);
    logEvent("cart_remove", { productId: product.id, tile: product.tile });
    return;
  }
  setQuantity(product.id, quantity - 1);
}
