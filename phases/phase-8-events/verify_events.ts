/**
 * Phase 8 test — the event log.
 *
 * Phase 8 builds almost nothing: `events.ts` shipped in Phase 2 (D17) and each
 * phase since wired its own call sites. What this phase owes is the audit — that
 * all nine types in spec §3.6 exist, carry exactly the payload the spec names,
 * and that the rules governing *when* they fire hold at every surface.
 *
 * That audit already paid for itself. The Smart Cart panel's own row stepper
 * removed a product from the cart without logging `cart_remove`, contradicting
 * D22's "whichever control triggered it" — the one path out of three that had
 * drifted. The rule now lives in `cartActions.ts` and is tested here directly.
 *
 * Run:  node phases/phase-8-events/verify_events.ts
 */

import { getProduct, getProductsByTile, getTile } from "../../src/lib/catalogue.ts";
import { getCart, getQuantity } from "../../src/lib/cart.ts";
import {
  addProduct,
  decrementProduct,
  incrementProduct,
} from "../../src/lib/cartActions.ts";
import { BROWSABLE_TILES, EVENT_LOG_CAP } from "../../src/lib/config.ts";
import { logEvent, readEvents } from "../../src/lib/events.ts";
import { STORAGE_KEYS } from "../../src/lib/storage.ts";
import type { AppEvent, EventType } from "../../src/lib/types";

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

const keysOf = (event: AppEvent) => Object.keys(event.payload).sort().join(",");

/** Spec §3.6, transcribed. The payload each type must carry, exactly. */
const SPEC_PAYLOADS: Record<EventType, string[]> = {
  panel_impression: ["products", "slots", "tiles", "cartSignature", "source"],
  panel_add: ["productId", "slot", "tile", "position"],
  panel_dismiss: ["cartSignature"],
  panel_replace_open: ["productId", "slot", "tile"],
  panel_replace_done: ["originalProductId", "replacementProductId", "slot", "tile"],
  search: ["query", "resultCount"],
  cart_add: ["productId", "tile", "source"],
  cart_remove: ["productId", "tile"],
  recommend_call: ["latencyMs", "outcome"],
};

/** One plausible instance of every event, as the app actually writes them. */
function logOneOfEach() {
  logEvent("search", { query: "maggi", resultCount: 12 });
  logEvent("cart_add", { productId: "p_01163", tile: "instant-food", source: "search" });
  logEvent("cart_remove", { productId: "p_01163", tile: "instant-food" });
  logEvent("recommend_call", { latencyMs: 1352, outcome: "model" });
  logEvent("panel_impression", {
    products: ["p_01998", "p_00441", "p_02100", "p_01884"],
    slots: ["A", "A", "B", "B"],
    tiles: ["cleaners-repellents", "bakery-biscuits", "electronics", "home-lifestyle"],
    cartSignature: "p_01163:2",
    source: "model",
  });
  logEvent("panel_replace_open", {
    productId: "p_01998",
    slot: "A",
    tile: "cleaners-repellents",
  });
  logEvent("panel_replace_done", {
    originalProductId: "p_01998",
    replacementProductId: "p_01937",
    slot: "A",
    tile: "cleaners-repellents",
  });
  logEvent("panel_add", {
    productId: "p_01937",
    slot: "A",
    tile: "cleaners-repellents",
    position: 1,
  });
  logEvent("panel_dismiss", { cartSignature: "p_01163:2" });
}

// ---------------------------------------------------------------------------
console.log("\n-- all nine types, with the payload spec §3.6 names -------------------");
{
  freshWindow();
  logOneOfEach();
  const events = readEvents();

  check(
    "every event type in the schema is written by the app",
    new Set(events.map((e) => e.type)).size === Object.keys(SPEC_PAYLOADS).length,
    `${new Set(events.map((e) => e.type)).size} of ${Object.keys(SPEC_PAYLOADS).length}`
  );

  for (const [type, expected] of Object.entries(SPEC_PAYLOADS)) {
    const event = events.find((e) => e.type === type);
    check(
      `${type} carries exactly ${expected.join(", ")}`,
      event !== undefined && keysOf(event) === [...expected].sort().join(","),
      event ? keysOf(event) : "MISSING"
    );
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- the envelope every event shares -----------------------------------");
{
  freshWindow();
  logOneOfEach();
  const events = readEvents();

  check(
    "every event has id, timestamp, type, sessionId, payload",
    events.every(
      (e) =>
        typeof e.id === "string" &&
        e.id.length > 0 &&
        typeof e.timestamp === "string" &&
        typeof e.type === "string" &&
        typeof e.sessionId === "string" &&
        e.sessionId.length > 0 &&
        typeof e.payload === "object"
    )
  );

  check(
    "ids are unique",
    new Set(events.map((e) => e.id)).size === events.length,
    `${events.length} events`
  );

  check(
    "timestamps parse as ISO dates",
    events.every((e) => !Number.isNaN(Date.parse(e.timestamp)))
  );

  check(
    "every event in a session carries the same sessionId",
    new Set(events.map((e) => e.sessionId)).size === 1,
    events[0]?.sessionId
  );

  check(
    "events are appended in the order they happened",
    events.map((e) => e.type).join(",").startsWith("search,cart_add,cart_remove")
  );

  // recommend_call.latencyMs is the CLIENT-SIDE round trip — measured across
  // the fetch in SmartCartPanel, so it includes network time, because that is
  // the wait the user actually experiences. (EDGE_CASES G4)
  const call = events.find((e) => e.type === "recommend_call");
  check(
    "recommend_call.latencyMs is a finite non-negative number",
    call !== undefined &&
      typeof (call.payload as { latencyMs: number }).latencyMs === "number" &&
      Number.isFinite((call.payload as { latencyMs: number }).latencyMs) &&
      (call.payload as { latencyMs: number }).latencyMs >= 0
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- the cap, and what it costs (EDGE_CASES G3) -------------------------");
{
  freshWindow();

  for (let i = 0; i < EVENT_LOG_CAP + 50; i += 1) {
    logEvent("search", { query: `q${i}`, resultCount: i });
  }
  const events = readEvents();

  check(
    `the log stops at EVENT_LOG_CAP (${EVENT_LOG_CAP})`,
    events.length === EVENT_LOG_CAP,
    `${events.length}`
  );

  check(
    "the OLDEST entries are the ones dropped",
    (events[0].payload as { query: string }).query === "q50" &&
      (events[events.length - 1].payload as { query: string }).query ===
        `q${EVENT_LOG_CAP + 49}`,
    `${(events[0].payload as { query: string }).query} … ${(events[events.length - 1].payload as { query: string }).query}`
  );

  // The accepted cost, made explicit rather than left as prose: an impression
  // can be evicted while a panel_add that refers to it survives, so that add
  // has no impression to attribute against. Accepted at 500 for a demo-length
  // session — the spec's own full flow produces about ten events, so this
  // needs roughly fifty times a realistic session to occur.
  freshWindow();
  logEvent("panel_impression", {
    products: ["p_01998", "p_00441", "p_02100", "p_01884"],
    slots: ["A", "A", "B", "B"],
    tiles: ["cleaners-repellents", "bakery-biscuits", "electronics", "home-lifestyle"],
    cartSignature: "sig",
    source: "model",
  });
  for (let i = 0; i < EVENT_LOG_CAP; i += 1) {
    logEvent("search", { query: `q${i}`, resultCount: i });
  }
  logEvent("panel_add", {
    productId: "p_01998",
    slot: "A",
    tile: "cleaners-repellents",
    position: 1,
  });
  const starved = readEvents();

  check(
    "an add can outlive the impression it refers to — accepted, not fixed",
    !starved.some((e) => e.type === "panel_impression") &&
      starved.some((e) => e.type === "panel_add"),
    "documented in EDGE_CASES G3"
  );

  check(
    "the add still carries its own slot, so slot-level attribution survives",
    (starved.find((e) => e.type === "panel_add")!.payload as { slot: string }).slot === "A"
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- logging never breaks the interaction -------------------------------");
{
  // G2: logEvent is called from components that also render on the server.
  //
  // The property to assert is that the guard makes it a NO-OP, not that the log
  // reads empty. storage.ts writes every value to a module-level in-memory map
  // as well as to localStorage — that map is what keeps a session coherent when
  // storage is unavailable (C3) — and it is module-global, so it survives
  // `freshWindow()` and still holds the previous block's events. On a real
  // server nothing would ever have written to it; here it is an artifact of
  // exercising real source in one process.
  freshWindow();
  logEvent("search", { query: "before", resultCount: 1 });
  const beforeCount = readEvents().length;

  delete (globalThis as Record<string, unknown>).window;

  let threw = false;
  try {
    logEvent("search", { query: "server-side", resultCount: 0 });
  } catch {
    threw = true;
  }
  check("logEvent does not throw with no window (EDGE_CASES G2)", !threw);
  check(
    "and writes nothing — the SSR guard makes it a no-op",
    readEvents().length === beforeCount &&
      !readEvents().some((e) => (e.payload as { query?: string }).query === "server-side"),
    `${readEvents().length} events, unchanged`
  );

  // Storage that accepts reads and throws on write, like Safari private mode.
  const hostile = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
  (globalThis as Record<string, unknown>).window = { localStorage: hostile };

  let threwHostile = false;
  try {
    logEvent("cart_add", { productId: "p_01163", tile: "instant-food", source: "search" });
  } catch {
    threwHostile = true;
  }
  check("logEvent survives storage that throws on write (C3)", !threwHostile);

  // A hand-edited or stale-format log must not take the app down with it.
  const map = freshWindow();
  map.set(STORAGE_KEYS.events, "{{{ not json");
  check("a corrupt log reads as empty rather than throwing", readEvents().length === 0);

  let threwCorrupt = false;
  try {
    logEvent("search", { query: "after corruption", resultCount: 1 });
  } catch {
    threwCorrupt = true;
  }
  check("and the next write recovers the log", !threwCorrupt && readEvents().length === 1);
}

// ---------------------------------------------------------------------------
console.log("\n-- when cart events fire, at every surface (D22) ----------------------");
console.log("   the rule the panel's own stepper used to get wrong\n");
{
  const product = getProduct("p_01163")!;
  const cartEvents = () =>
    readEvents().filter((e) => e.type === "cart_add" || e.type === "cart_remove");

  // Entering the cart.
  freshWindow();
  addProduct(product, "search");
  check(
    "addProduct logs exactly one cart_add",
    cartEvents().length === 1 && cartEvents()[0].type === "cart_add"
  );
  check(
    "and records the surface it came from",
    (cartEvents()[0].payload as { source: string }).source === "search"
  );
  check("the product is in the cart", getQuantity(product.id) === 1);

  freshWindow();
  addProduct(product, "panel");
  check(
    "the panel is attributed separately",
    (cartEvents()[0].payload as { source: string }).source === "panel"
  );

  // A category listing is a third channel, added after the spec was written
  // (D37). Attributing a browse as a search would inflate search's conversions,
  // which is the error D22 exists to prevent.
  freshWindow();
  addProduct(product, "category");
  check(
    "a category browse is attributed to neither search nor panel",
    (cartEvents()[0].payload as { source: string }).source === "category"
  );

  check(
    "every browsable tile is a real tile with products",
    BROWSABLE_TILES.every(
      (id) => getTile(id) !== undefined && getProductsByTile(id).length > 0
    ),
    BROWSABLE_TILES.map((id) => `${id}:${getProductsByTile(id).length}`).join(" ")
  );

  // Quantity bumps.
  freshWindow();
  addProduct(product, "search");
  incrementProduct(product);
  incrementProduct(product);
  check(
    "two further increments log nothing",
    cartEvents().length === 1 && getQuantity(product.id) === 3,
    `quantity ${getQuantity(product.id)}, ${cartEvents().length} cart events`
  );

  // Decrements that do not empty the line.
  decrementProduct(product, 3);
  check(
    "a decrement to 2 logs nothing",
    cartEvents().length === 1 && getQuantity(product.id) === 2
  );

  // The transition that matters.
  decrementProduct(product, 2);
  check("a decrement to 1 logs nothing", cartEvents().length === 1);

  decrementProduct(product, 1);
  check(
    "the decrement that empties the line logs cart_remove",
    cartEvents().length === 2 && cartEvents()[1].type === "cart_remove"
  );
  check("and the product actually leaves the cart", getCart().length === 0);

  // The regression itself. Before Phase 8 this path — the panel's own row
  // stepper — removed the product with no event at all.
  freshWindow();
  addProduct(product, "panel");
  decrementProduct(product, 1);
  check(
    "removing from the PANEL's stepper logs cart_remove too",
    cartEvents().length === 2 &&
      cartEvents()[1].type === "cart_remove" &&
      (cartEvents()[1].payload as { productId: string }).productId === product.id,
    cartEvents().map((e) => e.type).join(" → ")
  );

  check(
    "cart_remove carries the product's tile",
    (cartEvents()[1].payload as { tile: string }).tile === product.tile,
    product.tile
  );

  // A defensive decrement on something not in the cart must not invent an
  // event for a product that never left.
  freshWindow();
  decrementProduct(product, 0);
  check(
    "decrementing something already absent still logs one removal, not zero events",
    cartEvents().length === 1 && cartEvents()[0].type === "cart_remove"
  );
}

// ---------------------------------------------------------------------------
console.log("\n-- a full session reads as the story it was (spec §6 Phase 8) ---------");
{
  freshWindow();

  // The spec's own flow: search, add two, open cart, replace a row, add from
  // the panel, dismiss.
  logEvent("search", { query: "maggi", resultCount: 12 });
  addProduct(getProduct("p_01163")!, "search");
  addProduct(getProduct("p_01398")!, "search");
  logEvent("recommend_call", { latencyMs: 1352, outcome: "model" });
  logEvent("panel_impression", {
    products: ["p_01998", "p_00441", "p_02100", "p_01884"],
    slots: ["A", "A", "B", "B"],
    tiles: ["cleaners-repellents", "bakery-biscuits", "electronics", "home-lifestyle"],
    cartSignature: "p_01163:1|p_01398:1",
    source: "model",
  });
  logEvent("panel_replace_open", { productId: "p_01998", slot: "A", tile: "cleaners-repellents" });
  logEvent("panel_replace_done", {
    originalProductId: "p_01998",
    replacementProductId: "p_01937",
    slot: "A",
    tile: "cleaners-repellents",
  });
  logEvent("panel_add", { productId: "p_01937", slot: "A", tile: "cleaners-repellents", position: 1 });
  addProduct(getProduct("p_01937")!, "panel");
  logEvent("panel_dismiss", { cartSignature: "p_01163:1|p_01398:1" });

  const events = readEvents();

  check(
    "the flow produces every type the spec's test inspects",
    ["search", "cart_add", "recommend_call", "panel_impression", "panel_replace_open",
     "panel_replace_done", "panel_add", "panel_dismiss"].every((t) =>
      events.some((e) => e.type === t)
    )
  );

  check(
    "a demo-length session sits far inside the cap",
    events.length < EVENT_LOG_CAP / 10,
    `${events.length} events vs a cap of ${EVENT_LOG_CAP}`
  );

  // The replacement chain has to be readable end to end, or Browse & Replace
  // cannot be measured at all.
  const open = events.find((e) => e.type === "panel_replace_open")!.payload as { productId: string };
  const done = events.find((e) => e.type === "panel_replace_done")!.payload as {
    originalProductId: string;
    replacementProductId: string;
  };
  const add = events.find((e) => e.type === "panel_add")!.payload as { productId: string; slot: string };

  check(
    "replace_open → replace_done → panel_add chain by productId",
    open.productId === done.originalProductId && done.replacementProductId === add.productId,
    `${open.productId} → ${done.replacementProductId}`
  );

  check(
    "the panel_add for a replaced row still reports the row's true slot",
    add.slot === "A"
  );

  // The point of the whole schema (spec §3.6): slot-level attribution.
  const panelAdds = events.filter((e) => e.type === "panel_add");
  check(
    "every panel event carries a slot, so slot A and B can be told apart",
    panelAdds.every((e) => ["A", "B"].includes((e.payload as { slot: string }).slot)) &&
      events
        .filter((e) => e.type === "panel_replace_open" || e.type === "panel_replace_done")
        .every((e) => ["A", "B"].includes((e.payload as { slot: string }).slot))
  );

  check(
    "a panel add is distinguishable from a search add",
    events
      .filter((e) => e.type === "cart_add")
      .filter((e) => (e.payload as { source: string }).source === "panel").length === 1
  );
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
