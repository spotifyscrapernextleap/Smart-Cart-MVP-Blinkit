/**
 * Phase 3 test — src/lib/cart.ts.
 *
 * Fakes `window.localStorage` the same way Phase 1's verify_storage.ts does,
 * then exercises cart.ts against the REAL catalogue (not a mock) so the
 * known/unknown product ids used below are genuine.
 *
 * Run:  node phases/phase-3-cart/verify_cart.ts
 */

import {
  addToCart,
  cartSignature,
  getCart,
  getItemCount,
  getQuantity,
  getSubtotal,
  removeFromCart,
  setQuantity,
  subscribeCart,
} from "../../src/lib/cart.ts";
import { STORAGE_KEYS } from "../../src/lib/storage.ts";
import { getProduct, products } from "../../src/lib/catalogue.ts";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}${detail ? `  — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${label}${detail ? `  — ${detail}` : ""}`);
  }
}

function makeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    storage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage,
  };
}

function freshWindow() {
  const { map, storage } = makeStorage();
  (globalThis as Record<string, unknown>).window = { localStorage: storage };
  return map;
}

// Two real, known-good ids, plus one id nothing in the catalogue will ever have.
const KNOWN_A = products[0].id;
const KNOWN_B = products[1].id;
const UNKNOWN = "p_99999";

// ---------------------------------------------------------------------------
console.log("\n-- basic add / remove / setQuantity ------------------------------");
freshWindow();

addToCart(KNOWN_A);
check("addToCart adds a new line at quantity 1 by default", getQuantity(KNOWN_A) === 1);

addToCart(KNOWN_A, 2);
check("addToCart on an existing line sums the quantity", getQuantity(KNOWN_A) === 3);

addToCart(KNOWN_B, 5);
check("a second product is a separate line", getCart().length === 2);

setQuantity(KNOWN_A, 10);
check("setQuantity overwrites (not adds to) the existing quantity", getQuantity(KNOWN_A) === 10);

removeFromCart(KNOWN_B);
check("removeFromCart drops the line entirely", getQuantity(KNOWN_B) === 0);
check("cart now holds exactly one line", getCart().length === 1);

setQuantity(KNOWN_A, 0);
check("setQuantity(0) removes the line (EDGE_CASES C5)", getCart().length === 0);

setQuantity(KNOWN_B, 5);
check("setQuantity on a product not in the cart is a no-op", getCart().length === 0);

// ---------------------------------------------------------------------------
console.log("\n-- quantity clamping (EDGE_CASES C5) -----------------------------");
freshWindow();

addToCart(KNOWN_A, 500);
check("addToCart clamps a huge quantity to MAX_CART_QUANTITY", getQuantity(KNOWN_A) === 99);

setQuantity(KNOWN_A, -5);
check("setQuantity with a negative number removes the line", getQuantity(KNOWN_A) === 0);

addToCart(KNOWN_A, 1);
setQuantity(KNOWN_A, 1.9);
check("setQuantity floors a fractional quantity", getQuantity(KNOWN_A) === 1);

// ---------------------------------------------------------------------------
console.log("\n-- unknown product ids --------------------------------------------");
freshWindow();

addToCart(UNKNOWN, 3);
check("addToCart silently ignores an id the catalogue does not have", getCart().length === 0);

// ---------------------------------------------------------------------------
console.log("\n-- stale-id healing on read (EDGE_CASES C2) -----------------------");
{
  const map = freshWindow();
  // Simulate a cart written before a catalogue rebuild: one good line, one line
  // whose product no longer exists.
  map.set(
    STORAGE_KEYS.cart,
    JSON.stringify([
      { productId: KNOWN_A, quantity: 2 },
      { productId: UNKNOWN, quantity: 4 },
    ])
  );

  const lines = getCart();
  check("the stale id is dropped from what getCart() returns", lines.length === 1 && lines[0].productId === KNOWN_A);

  const healed = JSON.parse(map.get(STORAGE_KEYS.cart) ?? "[]");
  check(
    "storage itself is rewritten without the stale id, not just the in-memory read",
    healed.length === 1 && healed[0].productId === KNOWN_A
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- defensive sanitising of hand-edited storage --------------------");
{
  const map = freshWindow();
  // Two raw lines for the SAME product — should never happen through the public
  // API, but a hand-edit in devtools can produce it.
  map.set(
    STORAGE_KEYS.cart,
    JSON.stringify([
      { productId: KNOWN_A, quantity: 3 },
      { productId: KNOWN_A, quantity: 4 },
    ])
  );
  check(
    "duplicate raw lines for the same product are merged",
    getCart().length === 1 && getQuantity(KNOWN_A) === 7
  );
}
{
  const map = freshWindow();
  map.set(
    STORAGE_KEYS.cart,
    JSON.stringify([
      { productId: KNOWN_A, quantity: 0 },
      { productId: KNOWN_B, quantity: -3 },
    ])
  );
  check(
    "raw lines at quantity 0 or negative are dropped on read",
    getCart().length === 0
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- derived values --------------------------------------------------");
freshWindow();

addToCart(KNOWN_A, 2);
addToCart(KNOWN_B, 1);
const priceA = getProduct(KNOWN_A)!.price;
const priceB = getProduct(KNOWN_B)!.price;

check("getItemCount sums quantities across lines", getItemCount() === 3);
check(
  "getSubtotal sums price * quantity using real catalogue prices",
  getSubtotal() === priceA * 2 + priceB * 1,
  `expected ${priceA * 2 + priceB * 1}, got ${getSubtotal()}`
);

const [first, second] = [KNOWN_A, KNOWN_B].sort();
const expectedSignature =
  first === KNOWN_A ? `${KNOWN_A}:2|${KNOWN_B}:1` : `${KNOWN_B}:1|${KNOWN_A}:2`;
check(
  "cartSignature sorts ascending and joins id:quantity with |  (spec §4 Step 1)",
  cartSignature() === expectedSignature,
  `-> "${cartSignature()}"`
);

// ---------------------------------------------------------------------------
console.log("\n-- subscription ------------------------------------------------------");
freshWindow();

let notifications = 0;
const unsubscribe = subscribeCart(() => {
  notifications += 1;
});

addToCart(KNOWN_A, 1);
check("a mutation notifies subscribers", notifications === 1);

removeFromCart(KNOWN_A);
check("a second mutation notifies again", notifications === 2);

unsubscribe();
addToCart(KNOWN_A, 1);
check("unsubscribing stops further notifications", notifications === 2);

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
