/**
 * Phase 1 test — src/lib/storage.ts.
 *
 * Exercises the three failure modes the wrapper exists to absorb: no window at
 * all (SSR), a hostile localStorage that throws on every call, and stored values
 * that are corrupt or the wrong shape. Each assertion here fails without the
 * corresponding guard in storage.ts.
 *
 * Run:  node phases/phase-1-scaffold/verify_storage.ts
 *
 * No test runner. Node 24 executes TypeScript directly, and the build spec is
 * explicit about not adding dependencies that are not required.
 */

import {
  STORAGE_KEYS,
  clearAll,
  getItem,
  isCartLines,
  isSession,
  removeItem,
  setItem,
} from "../../src/lib/storage.ts";
import type { CartLine, Session } from "../../src/lib/types.ts";

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

/** Minimal in-memory Storage stand-in, optionally hostile. */
function makeStorage(opts: { throwOnEverything?: boolean } = {}) {
  const map = new Map<string, string>();
  const guard = () => {
    if (opts.throwOnEverything) throw new DOMException("QuotaExceededError");
  };
  return {
    map,
    storage: {
      getItem: (k: string) => {
        guard();
        return map.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        guard();
        map.set(k, v);
      },
      removeItem: (k: string) => {
        guard();
        map.delete(k);
      },
      clear: () => {
        guard();
        map.clear();
      },
      key: () => null,
      length: 0,
    } as unknown as Storage,
  };
}

function setWindow(storage: Storage | null) {
  if (storage === null) {
    delete (globalThis as Record<string, unknown>).window;
    return;
  }
  (globalThis as Record<string, unknown>).window = { localStorage: storage };
}

const validSession: Session = { sessionId: "s_test", startedAt: "2026-08-02T00:00:00.000Z" };
const validCart: CartLine[] = [{ productId: "p_00001", quantity: 2 }];

// ---------------------------------------------------------------------------
console.log("\n-- no window (server render) ------------------------------------");
setWindow(null);

setItem(STORAGE_KEYS.cart, validCart);
check(
  "setItem does not throw without a window",
  true,
  "would throw on window.localStorage otherwise"
);
check(
  "getItem round-trips through the memory fallback",
  JSON.stringify(getItem(STORAGE_KEYS.cart, [], isCartLines)) === JSON.stringify(validCart)
);
clearAll();
check("clearAll does not throw without a window", true);

// ---------------------------------------------------------------------------
console.log("\n-- hostile localStorage (private mode / quota) ------------------");
const hostile = makeStorage({ throwOnEverything: true });
setWindow(hostile.storage);

let threw = false;
try {
  setItem(STORAGE_KEYS.cart, validCart);
  getItem(STORAGE_KEYS.cart, [], isCartLines);
  removeItem(STORAGE_KEYS.cart);
  clearAll();
} catch {
  threw = true;
}
check("every operation survives a Storage that throws on all calls", !threw);

// ---------------------------------------------------------------------------
console.log("\n-- corrupt and wrong-shape values -------------------------------");
const good = makeStorage();
setWindow(good.storage);

good.map.set(STORAGE_KEYS.session, "{not valid json");
const healedSession = getItem<Session | null>(
  STORAGE_KEYS.session,
  null,
  (v): v is Session | null => v === null || isSession(v)
);
check("unparseable JSON returns the fallback", healedSession === null);
check(
  "unparseable JSON is cleared from storage, not left to fail again",
  !good.map.has(STORAGE_KEYS.session)
);

good.map.set(STORAGE_KEYS.cart, JSON.stringify([{ productId: 123, quantity: "two" }]));
const healedCart = getItem<CartLine[]>(STORAGE_KEYS.cart, [], isCartLines);
check("valid JSON of the wrong shape returns the fallback", healedCart.length === 0);
check("wrong-shape value is cleared", !good.map.has(STORAGE_KEYS.cart));

good.map.set(STORAGE_KEYS.cart, JSON.stringify(validCart));
check(
  "a well-formed value is returned untouched",
  JSON.stringify(getItem(STORAGE_KEYS.cart, [], isCartLines)) === JSON.stringify(validCart)
);

// A shape check that only inspects the top level would accept this; the guard
// walks every line, because one bad entry is enough to crash a cart render.
good.map.set(
  STORAGE_KEYS.cart,
  JSON.stringify([{ productId: "p_00001", quantity: 1 }, { productId: "p_00002" }])
);
check(
  "one malformed line invalidates the whole cart",
  getItem<CartLine[]>(STORAGE_KEYS.cart, [], isCartLines).length === 0
);

// NaN and Infinity survive JSON.parse via bare tokens only, but a hand-edited
// quantity of null is realistic and must not reach arithmetic.
good.map.set(STORAGE_KEYS.cart, JSON.stringify([{ productId: "p_1", quantity: null }]));
check(
  "null quantity is rejected",
  getItem<CartLine[]>(STORAGE_KEYS.cart, [], isCartLines).length === 0
);

// ---------------------------------------------------------------------------
console.log("\n-- clearAll ------------------------------------------------------");
setItem(STORAGE_KEYS.cart, validCart);
setItem(STORAGE_KEYS.session, validSession);
clearAll();
check(
  "clearAll removes every app key",
  Object.values(STORAGE_KEYS).every((k) => !good.map.has(k)),
  `${good.map.size} keys left`
);

setWindow(null);
console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
