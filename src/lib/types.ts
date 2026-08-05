/**
 * Shared types. These mirror the committed seed files in /data exactly — if a
 * field is added there, it is added here, and nowhere is a seed file read as
 * `any`.
 */

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

/** A tile id, e.g. "pet-store". The unit of all recommendation logic. */
export type TileId = string;

/** A product id, e.g. "p_00417". Positional, and unstable across catalogue rebuilds. */
export type ProductId = string;

export interface Tile {
  id: TileId;
  /** Display name, e.g. "Pet Store". Used verbatim in reason lines. */
  label: string;
  /** Display grouping on the home screen only. Carries no recommendation logic. */
  section: string;
  /** False means the tile's products exist only to be recommended, never found. */
  searchable: boolean;
  consumableDefault: boolean;
  targetCount: number;
}

export interface Product {
  id: ProductId;
  name: string;
  brand: string;
  tile: TileId;
  /** Rupees, integer. */
  price: number;
  /** Rupees, integer. Retained but deliberately not rendered in v1 (spec §8). */
  mrp: number;
  imagePath: string;
  /** Gates search results. Derived from the product's tile. */
  isSearchable: boolean;
  /** Durables the persona already owns are excluded from dormant candidates. */
  isConsumable: boolean;
  /** 1..n within the tile. The only popularity signal available. */
  bestsellerRank: number;
}

export interface OrderItem {
  productId: ProductId;
  quantity: number;
}

export interface Order {
  orderId: string;
  /**
   * Days before today, not a date. Absolute dates rot: a history seeded in
   * August is entirely dormant by November and the demo silently breaks.
   */
  daysAgo: number;
  items: OrderItem[];
}

export interface PersonaUser {
  id: string;
  accountAgeDays: number;
  segment: string;
}

export interface History {
  user: PersonaUser;
  orders: Order[];
}

/** Query rewrites applied before Fuse.js sees the term. */
export type SearchAliases = Record<string, string>;

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export interface CartLine {
  productId: ProductId;
  quantity: number;
}

/**
 * Sorted product ids joined with their quantities, e.g. "p_00412:2|p_00877:1".
 * The identity of a cart, and the key the panel is cached against.
 */
export type CartSignature = string;

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

/** A = dormant (the engine), B = never-bought (the goal). */
export type SlotType = "A" | "B";

/** Whether the panel came from the model or the deterministic path. */
export type RecommendSource = "model" | "fallback";

export interface PanelRow {
  productId: ProductId;
  slot: SlotType;
  tile: TileId;
  reason: string;
  /** 1–4. Preserved across a Browse & Replace swap. */
  position: number;
}

export interface RecommendResponse {
  source: RecommendSource;
  cartSignature: CartSignature;
  /** Always four rows, ordered A, A, B, B. */
  rows: PanelRow[];
  /**
   * Full ranked shortlists for the four chosen tiles. Browse & Replace reads
   * from here, so opening the sheet costs no network call.
   */
  shortlists: Record<TileId, ProductId[]>;
  /**
   * Beyond the spec's Step 11 shape, and deliberately so.
   *
   * `source` only says model-or-not; `recommend_call.outcome` (spec §3.6) needs
   * to know *why*. On screen a fallback panel and a model panel are identical,
   * so without this the client would have to guess, and "the model path stopped
   * working" is exactly the thing the event exists to surface.
   */
  outcome?: RecommendOutcome;
}

export interface RecommendRequest {
  cart: CartLine[];
  signature: CartSignature;
}

/** Tile classification against the persona's history. */
export type TileClass = "active" | "dormant" | "never-bought";

export interface TileStats {
  tile: TileId;
  orderCount: number;
  /** Null when the tile has never been ordered from. */
  mostRecentDaysAgo: number | null;
  classification: TileClass;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventType =
  | "panel_impression"
  | "panel_add"
  | "panel_dismiss"
  | "panel_replace_open"
  | "panel_replace_done"
  | "search"
  | "cart_add"
  | "cart_remove"
  | "recommend_call";

/**
 * Why the panel is what it is. On screen a fallback panel and a model panel are
 * identical, so this field is the only way to discover the model path has died.
 */
export type RecommendOutcome =
  | "model"
  | "fallback_timeout"
  | "fallback_ratelimit"
  | "fallback_invalid"
  | "fallback_error"
  /**
   * Added beyond the spec's five. No model was attempted because no key is
   * configured — which is a distinct and highly actionable diagnosis, and the
   * single most likely reason a deploy that works locally serves fallback
   * panels in production (spec §6 Phase 9's test exists to catch exactly this).
   * Folding it into `fallback_error` would hide it behind genuine failures.
   */
  | "fallback_nokey";

/** Which surface a product entered the cart from. See `cart_add` below. */
/**
 * Which surface a product entered the cart through.
 *
 * The spec (§3.6) names `search | panel`. `category` was added by D37 and
 * `suggested` by Phase 10 — both for the same reason: attributing a browse or
 * a related-product tap as a search would inflate search's conversions, which
 * is the exact error D22 exists to prevent. A new surface gets a new value.
 *
 * `suggested` covers both "You might also like" and the "Special deal" card.
 * They are one channel — cart-adjacent complements — and separating them would
 * split a number too small to read.
 */
export type CartAddSource = "search" | "panel" | "category" | "suggested";

export interface EventPayloads {
  panel_impression: {
    products: ProductId[];
    slots: SlotType[];
    tiles: TileId[];
    cartSignature: CartSignature;
    source: RecommendSource;
  };
  /** `slot` is load-bearing: blended panel numbers hide whether slot B did anything. */
  panel_add: { productId: ProductId; slot: SlotType; tile: TileId; position: number };
  panel_dismiss: { cartSignature: CartSignature };
  panel_replace_open: { productId: ProductId; slot: SlotType; tile: TileId };
  panel_replace_done: {
    originalProductId: ProductId;
    replacementProductId: ProductId;
    slot: SlotType;
    tile: TileId;
  };
  search: { query: string; resultCount: number };
  /**
   * `source` gains "category" beyond the spec's `search | panel`.
   *
   * Spec §3.6 predates browsable categories, which the spec defers entirely.
   * Now that a product can enter the cart from a category listing, calling that
   * "search" would attribute a browse to a channel the user never used — and
   * inflating a channel's conversions is precisely the error D22 exists to
   * prevent. A third value is the honest option. (D37)
   */
  cart_add: { productId: ProductId; tile: TileId; source: CartAddSource };
  cart_remove: { productId: ProductId; tile: TileId };
  recommend_call: { latencyMs: number; outcome: RecommendOutcome };
}

export interface AppEvent<T extends EventType = EventType> {
  id: string;
  timestamp: string;
  type: T;
  sessionId: string;
  payload: EventPayloads[T];
}

export interface Session {
  sessionId: string;
  startedAt: string;
}
