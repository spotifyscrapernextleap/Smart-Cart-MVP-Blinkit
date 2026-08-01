# Smart Cart — MVP Build Specification

**Audience:** an AI coding agent (Claude Code / Antigravity).
**Instruction:** Follow this document literally. Where it names a file path, use that path. Where it names a constant, use that name. Do not add features, libraries, or abstractions that are not specified here. If something is genuinely ambiguous, stop and ask rather than inventing.

---

## 1. Overview

### What is being built

A deployed, functional web MVP that reproduces the Blinkit shopping flow for a single hardcoded user and inserts a new feature — **Smart Cart** — on the cart page.

Three screens:

1. **Home** — a Blinkit-style home screen. The only interactive element is the search bar. Category tiles are rendered but inert. Tiles in non-searchable categories are visually dimmed.
2. **Search results** — products matching the query, from the searchable catalogue only. Each product can be added to the cart.
3. **Cart** — cart line items, then the **Smart Cart panel**, then Bill details.

### What the Smart Cart panel does

It renders exactly four product recommendations the user did not search for:

- **2 rows from slot type A (dormant)** — tiles the user has ordered from before, but not in the last 30 days.
- **2 rows from slot type B (never-bought)** — tiles the user has never ordered from.

Each row carries a product image, name, price, a one-line reason, an ADD control, and a **Browse & Replace** control that opens alternatives from the same tile.

Slot allocation is fixed at 2+2 and is enforced by code, not by the language model.

### The user

There is exactly one user. Whoever opens the URL is a tenured "Dabbler" whose purchase history is seed data. There is no login, no persona picker, no account.

### Non-negotiable behaviours

| Rule | Enforcement |
|---|---|
| Exactly 2 slot-A rows and 2 slot-B rows | Code. The model can only choose *which* products fill positions it is given. |
| All four rows come from four different tiles | Code, by construction of the shortlists. |
| Slot-B products never exceed the price ceiling | Code. Filtered out before the model ever sees them. |
| A durable product the user already owns is never re-recommended | Code, via `isConsumable`. |
| Every reason line is true given the seed history | Code supplies the facts; the model only phrases them. |
| The panel always renders four rows, even when the model call fails | Deterministic fallback path. |
| The panel does not recompute while the user is on the cart page | Computed once on mount, cached by cart signature. |

### Assumptions this spec makes

1. No real Blinkit data, API, or user base exists. All data is synthetic and committed to the repo.
2. The deployment target is a public URL an evaluator opens on a phone. Uptime, scale, and auth are out of scope.
3. Order history is stored as **days-ago offsets, not absolute dates**, so dormancy stays correct no matter when the app is opened. See §3.3.
4. Product images are generated flat tiles, not photographs.
5. The evaluator will not perform five separate cart visits, so fatigue suppression is out of scope for v1.

---

## 2. Stack and rationale

| Layer | Choice | Why this and not something else |
|---|---|---|
| Framework | **Next.js 14+, App Router, TypeScript** | One repo, one dev command, one deploy. Needs exactly one server-side file (the recommend route) to hold the API key; everything else is a client component. |
| Styling | **Tailwind CSS** | No component library. The UI is four component types — tile, product card, cart line, panel row. A component library adds a config step and a dependency to serve nothing. |
| Search | **Fuse.js**, client-side | Typo tolerance is the actual failure mode (a stranger typing `colgat`). ~20KB, no service, no key, deterministic. |
| Inference | **Groq free tier** via the `openai` npm package pointed at `https://api.groq.com/openai/v1` | Groq exposes an OpenAI-compatible endpoint. Free tier, no per-token charge, very low latency. |
| Model | `llama-3.3-70b-versatile` | Pinned in one constant. Swap to `openai/gpt-oss-120b` if JSON adherence is poor. |
| Persistence | **Seed JSON in the repo** (read server-side) + **localStorage** (cart, events) | ~2,150 products and ~200 orders is a file, not a database. A hosted DB adds an idle-pause failure mode on the day the demo is graded, and with one hardcoded user a shared cart row is a bug — concurrent visitors would collide. |
| Hosting | **Vercel**, deployed from GitHub | Free tier, no idle pause, native Next.js support. |
| Data prep | **Python 3 + pandas + Pillow**, run locally, once | The reduction and image scripts are developer tools. They are never invoked by the app and are not deployed. |

**Explicitly not used:** any database, any ORM, any auth provider, any analytics SDK, any component library, any state management library, any vector store, any embedding model.

---

## 3. Data model

All seed data lives in `/data` and is committed to git.

### 3.1 `/data/tiles.json`

The taxonomy. Two levels: `section` is for display grouping on the home screen; `tile` is the unit of all recommendation logic — dormancy, never-bought, diversity, and reason lines all operate on tiles.

```json
[
  {
    "id": "chips-namkeen",
    "label": "Chips & Namkeen",
    "section": "Snacks & Drinks",
    "searchable": true,
    "consumableDefault": true,
    "targetCount": 90
  }
]
```

Complete tile list. `searchable: true` means the tile's products appear in search results. `searchable: false` means the products exist only to be recommended.

| Tile id | Label | Section | searchable | consumableDefault | targetCount |
|---|---|---|---|---|---|
| `vegetables-fruits` | Vegetables & Fruits | Grocery & Kitchen | true | true | 90 |
| `atta-rice-dal` | Atta, Rice & Dal | Grocery & Kitchen | true | true | 120 |
| `oil-ghee-masala` | Oil, Ghee & Masala | Grocery & Kitchen | true | true | 120 |
| `dairy-bread-eggs` | Dairy, Bread & Eggs | Grocery & Kitchen | true | true | 110 |
| `bakery-biscuits` | Bakery & Biscuits | Grocery & Kitchen | true | true | 100 |
| `dry-fruits-cereals` | Dry Fruits & Cereals | Grocery & Kitchen | true | true | 100 |
| `chicken-meat-fish` | Chicken, Meat & Fish | Grocery & Kitchen | true | true | 70 |
| `kitchenware-appliances` | Kitchenware & Appliances | Grocery & Kitchen | **false** | **false** | 80 |
| `chips-namkeen` | Chips & Namkeen | Snacks & Drinks | true | true | 90 |
| `sweets-chocolates` | Sweets & Chocolates | Snacks & Drinks | true | true | 90 |
| `drinks-juices` | Drinks & Juices | Snacks & Drinks | true | true | 100 |
| `tea-coffee-milk-drinks` | Tea, Coffee & Milk Drinks | Snacks & Drinks | true | true | 80 |
| `instant-food` | Instant Food | Snacks & Drinks | true | true | 100 |
| `sauces-spreads` | Sauces & Spreads | Snacks & Drinks | true | true | 90 |
| `ice-creams-more` | Ice Creams & More | Snacks & Drinks | true | true | 48 |
| `bath-body` | Bath & Body | Beauty & Personal Care | **false** | true | 80 |
| `hair` | Hair | Beauty & Personal Care | **false** | true | 70 |
| `skin-face` | Skin & Face | Beauty & Personal Care | **false** | true | 70 |
| `beauty-cosmetics` | Beauty & Cosmetics | Beauty & Personal Care | **false** | true | 48 |
| `feminine-hygiene` | Feminine Hygiene | Beauty & Personal Care | **false** | true | 50 |
| `baby-care` | Baby Care | Beauty & Personal Care | **false** | true | 70 |
| `health-pharma` | Health & Pharma | Beauty & Personal Care | **false** | true | 70 |
| `home-lifestyle` | Home & Lifestyle | Household Essentials | true | **false** | 90 |
| `cleaners-repellents` | Cleaners & Repellents | Household Essentials | true | true | 100 |
| `stationery-games` | Stationery & Games | Household Essentials | true | **false** | 60 |
| `electronics` | Electronics | Household Essentials | **false** | **false** | 60 |
| `pet-store` | Pet Store | Pet Store | **false** | true | 80 |

Two Blinkit tiles are **omitted** because the source dataset has zero rows for them: Paan Corner, Sexual Wellness.

### 3.2 `/data/catalogue.json`

Array of products. Generated by `scripts/reduce_catalogue.py` (§7.1) and committed.

```json
{
  "id": "p_00417",
  "name": "Pedigree Adult Dry Dog Food Chicken & Vegetables 1.2 kg",
  "brand": "Pedigree",
  "tile": "pet-store",
  "price": 349,
  "mrp": 399,
  "imagePath": "/images/p_00417.png",
  "isSearchable": false,
  "isConsumable": true,
  "bestsellerRank": 3
}
```

| Field | Type | Source | Purpose |
|---|---|---|---|
| `id` | string, `p_00001` | Generated | Stable key. Product names are duplicated 4,014 times in the source and cannot be keys. This is what the model returns and what every event references. |
| `name` | string | `product` column | Display. |
| `brand` | string | `brand` column | Display and search matching. |
| `tile` | string, a `tiles.json` id | Mapped from `sub_category` | The unit of all recommendation logic. |
| `price` | integer ₹ | `sale_price`, rounded | Display, price ceiling, cart total. |
| `mrp` | integer ₹ | `market_price`, rounded | Retained, **not rendered in v1**. Reserved for struck-through pricing. |
| `imagePath` | string | Generated | Points at a generated tile in `/public/images`. |
| `isSearchable` | boolean | From the product's tile | Gates search results. **This flag is the mechanism of the demo** — without it the user could find the "undiscovered" categories by searching. |
| `isConsumable` | boolean | Tile default + overrides | Durables the user already owns are excluded from dormant candidates. Consumables are not, because re-suggesting a lapsed staple is the intended behaviour. |
| `bestsellerRank` | integer, 1..n within tile | Assigned | Default ordering for never-bought shortlists and for the entire fallback path. The source dataset has no popularity signal; `rating` has 8,626 nulls and is not a substitute. |

Target size: **~2,150 products**, ~1,500 searchable and ~650 recommendable-only. Per-tile counts are in `targetCount` above. If a tile cannot reach its target from the source data, take everything available and record the shortfall in the script's console output — do not pad with duplicates.

### 3.3 `/data/history.json`

The persona and their orders. Hand-authored, committed, never mutated at runtime.

```json
{
  "user": {
    "id": "u_dabbler_01",
    "accountAgeDays": 247,
    "segment": "dabbler"
  },
  "orders": [
    {
      "orderId": "o_001",
      "daysAgo": 3,
      "items": [
        { "productId": "p_00412", "quantity": 2 },
        { "productId": "p_00877", "quantity": 1 }
      ]
    }
  ]
}
```

**`daysAgo`, not a date.** Absolute dates rot: a history seeded in August is entirely dormant by November, and the demo silently breaks. Every order stores an integer offset from today, resolved at request time. The seed is permanently correct.

The history must be **authored backwards from the panel you want to demonstrate.** Required shape:

- `accountAgeDays` ≥ 180, satisfying the tenure gate.
- **5–6 active tiles** — recurring orders, most recent within 7 days. These are the core basket the user searches within.
- **3–4 dormant tiles** — at least one order each, most recent between 35 and 120 `daysAgo`. At least one dormant tile must contain a **durable** product (e.g. a steel pet bowl from `pet-store`) so the durable-exclusion rule is observable. At least one dormant tile must contain a **consumable** the user bought repeatedly and then stopped, so the lapsed-staple case is observable.
- **Every remaining tile has zero orders**, forming the never-bought pool.
- **No tile is bought once and then re-bought after a gap** — that pattern reads as an Adopter, not a Dabbler.

Approximately 40 orders across ~200 line items.

### 3.4 `/data/search-aliases.json`

```json
{ "cold drink": "soft drinks", "atta": "flour", "curd": "yoghurt", "maida": "flour" }
```

Indian grocery vocabulary does not match the source dataset's column values, and no fuzzy algorithm fixes a vocabulary mismatch. The query is rewritten through this map before being handed to Fuse.js. Author entries while testing your own searches. Target 20–30 entries.

### 3.5 Runtime state — localStorage only

| Key | Shape | Written by |
|---|---|---|
| `sc_cart` | `[{ productId, quantity }]` | Cart actions |
| `sc_events` | `[Event]` (append-only) | `logEvent()` |
| `sc_session` | `{ sessionId, startedAt }` | Created on first load |
| `sc_panel_cache` | `{ [cartSignature]: RecommendResponse }` | Cart page after a successful fetch |

`?reset=1` on any URL clears all four keys on load and then strips the parameter. One line in the root layout. No UI.

### 3.6 Event schema — fixed now, consumed later

The `/metrics` page is deferred, but **the writes ship in v1**. Retrofitting event calls into finished components is the expensive part; the page that reads them is trivial. If the writes are deferred too, every session run before the page exists is lost.

Every event: `{ id, timestamp, type, sessionId, payload }`.

| `type` | `payload` |
|---|---|
| `panel_impression` | `products[4]`, `slots[4]` (`["A","A","B","B"]`), `tiles[4]`, `cartSignature`, `source` (`model` \| `fallback`) |
| `panel_add` | `productId`, `slot`, `tile`, `position` (1–4) |
| `panel_dismiss` | `cartSignature` |
| `panel_replace_open` | `productId`, `slot`, `tile` |
| `panel_replace_done` | `originalProductId`, `replacementProductId`, `slot`, `tile` |
| `search` | `query`, `resultCount` |
| `cart_add` | `productId`, `tile`, `source` (`search` \| `panel`) |
| `cart_remove` | `productId`, `tile` |
| `recommend_call` | `latencyMs`, `outcome` (`model` \| `fallback_timeout` \| `fallback_ratelimit` \| `fallback_invalid` \| `fallback_error`) |

`slot` on every panel event is load-bearing: aggregate panel numbers are useless because dormant rows dominate them and mask whether never-bought rows did anything. `recommend_call.outcome` is how you discover that the model path stopped working — on screen, a fallback panel and a model panel look identical.

---

## 4. Recommendation mechanism — step by step

Triggered once, on cart-page mount.

### Step 1 — Build the cart signature (client)

Sort the cart's product IDs ascending, join each with its quantity:

```
p_00412:2|p_00877:1|p_01203:1
```

This string is the identity of the cart.

### Step 2 — Check the cache (client)

If `sc_panel_cache[signature]` exists, render it and stop. No network call. This makes a repeat run of the same cart instant and identical.

### Step 3 — POST to `/api/recommend` (client → server)

Body: `{ cart: [{ productId, quantity }], signature }`.

This route runs server-side. It is the only place `GROQ_API_KEY` is readable.

### Step 4 — Load seed data (server)

Import `catalogue.json`, `history.json`, `tiles.json`. No network, no filesystem reads at request time — these are static imports resolved at build.

### Step 5 — Classify every tile (server)

For each tile, walk the persona's orders and compute `orderCount` and `mostRecentDaysAgo`.

- `orderCount === 0` → **never-bought**
- `mostRecentDaysAgo >= DORMANCY_THRESHOLD_DAYS` (30) → **dormant**
- otherwise → **active**

Also compute `ownedProductIds` — every `productId` appearing anywhere in the history.

### Step 6 — Select which tiles to offer the model (server)

- **Dormant:** sort dormant tiles by `mostRecentDaysAgo` **ascending** (most recently lapsed first). Take the first `DORMANT_TILES_OFFERED` (3). A tile dormant 35 days is a better reactivation bet than one dormant 300 days.
- **Never-bought:** sort never-bought tiles by `bestsellerRank` of their top product ascending. Take the first `NEVERBOUGHT_TILES_OFFERED` (4).

### Step 7 — Build shortlists (server)

`priceCeiling = max(PRICE_CEILING_FLOOR, cartSubtotal * PRICE_CEILING_RATIO)` — that is, `max(100, subtotal × 0.5)`. **No upper cap.**

For each of the 3 dormant tiles:
- Take all products in that tile.
- Exclude any product where `ownedProductIds.includes(id) && !isConsumable`.
- Sort by `bestsellerRank`, take the top `SHORTLIST_SIZE` (12).

For each of the 4 never-bought tiles:
- Take all products in that tile.
- **Exclude every product where `price > priceCeiling`.**
- Sort by `bestsellerRank`, take the top 12.

The price ceiling is applied here, before the model sees anything. The model is structurally incapable of violating it.

If a shortlist ends up empty after filtering, drop that tile and take the next-ranked tile of the same type. If fewer than 2 tiles of a type survive, proceed with what exists and let the fallback fill remaining positions.

### Step 8 — Call the model, once (server)

Send: the cart contents with tile labels and prices; the 7 shortlists with product ids, names, brands, prices and tile labels; and the output contract.

The model's task, stated plainly in the prompt: given this cart, choose the product from each shortlist that most plausibly belongs alongside it, and write one short reason line for each.

Constraints stated in the prompt:
- Return exactly 2 dormant picks, from 2 **different** tiles.
- Return exactly 2 never-bought picks, from 2 **different** tiles.
- Every `productId` must come from the shortlists provided.
- Dormant reason lines must reference the tile, not the specific product — the product being shown is usually not a product the user previously bought. Use the supplied `weeksAgo` value. Example: `You last ordered from Pet Store 7 weeks ago`.
- Never-bought reason lines must not claim any user history. Inference and locality only. Example: `Popular with households near you`.
- Reason lines: maximum 8 words, no exclamation marks, no second-person imperatives.
- Respond with JSON only.

Required response shape:

```json
{
  "dormant": [
    { "productId": "p_00417", "reason": "You last ordered from Pet Store 7 weeks ago" },
    { "productId": "p_01120", "reason": "You used to order this regularly" }
  ],
  "neverBought": [
    { "productId": "p_00733", "reason": "Popular with households near you" },
    { "productId": "p_01455", "reason": "Most households ordering weekly staples keep this" }
  ]
}
```

Request JSON mode explicitly. Set `temperature: 0.3`. Abort at `MODEL_TIMEOUT_MS` (4000).

### Step 9 — Validate (server)

- Exactly 2 dormant and 2 never-bought entries.
- Every `productId` present in the shortlist it claims to come from.
- The 4 products span 4 distinct tiles.
- Every `reason` is a non-empty string ≤ 100 characters.

Any entry failing validation is discarded and replaced with the top-ranked unused product from the next available shortlist of the same slot type, with a template reason line. Whole-response failure routes to Step 10.

### Step 10 — Fallback

Fires on: timeout, HTTP 429, any non-200, malformed JSON, or validation failure of the whole response.

Returns the top-`bestsellerRank` product from the first 2 dormant shortlists and the first 2 never-bought shortlists, with template reason lines:

- Dormant: `You last ordered from {tileLabel} {n} weeks ago`
- Never-bought: `Popular with households near you`

Response marked `source: "fallback"`.

**Build this path first.** The fallback is the panel's default state and the model is an enhancement layered on top — not an error handler bolted on at the end. Phase 4 of the build order delivers a fully working panel with no API key present.

### Step 11 — Respond (server → client)

```json
{
  "source": "model",
  "cartSignature": "p_00412:2|p_00877:1",
  "rows": [
    { "productId": "p_00417", "slot": "A", "tile": "pet-store", "reason": "...", "position": 1 }
  ],
  "shortlists": {
    "pet-store": ["p_00417", "p_00420", "p_00431"]
  }
}
```

Row order is always A, A, B, B. `shortlists` contains the **full ranked lists** for the four chosen tiles — this is what Browse & Replace reads from, with no second call.

### Step 12 — Render and log (client)

Write the response into `sc_panel_cache[signature]`. Render four rows between the cart line items and Bill details. Log `panel_impression` and `recommend_call`.

While the request is in flight, render a fixed-height skeleton of exactly four rows. The panel must not change height when it resolves — the Bill details block must not shift down under the user's thumb.

### Step 13 — Interactions

**ADD** — the product enters the cart, the row is removed from the panel. Log `panel_add` (with slot and position) and `cart_add` (`source: "panel"`). **No backfill** — the panel is now three rows. If the user later removes that product from the cart, the row returns.

**Panel does not recompute.** The cart signature has changed, but the panel was computed for the visit, not for the cart. This is what prevents the four rows reshuffling while the user is reading them.

**Dismiss** — collapses the panel for the remainder of the visit. Log `panel_dismiss`.

**Browse & Replace** — opens a bottom sheet showing the remaining products from `shortlists[row.tile]`, in the order the model returned them, excluding the currently displayed product. Selecting one swaps the row in place. **The replacement keeps the original row's slot type and position.** Log `panel_replace_open` and `panel_replace_done` with both product IDs. The sheet opens instantly from memory — no network call.

---

## 5. File and folder structure

```
smart-cart/
├── data/
│   ├── catalogue.json              # generated by scripts/reduce_catalogue.py, committed
│   ├── history.json                # hand-authored, committed
│   ├── tiles.json                  # hand-authored, committed
│   └── search-aliases.json         # hand-authored, committed
│
├── scripts/                        # developer tools — run locally, never deployed
│   ├── reduce_catalogue.py
│   ├── generate_images.py
│   └── Blinkit_Products.xlsx       # source dump, committed for reproducibility
│
├── public/
│   └── images/                     # ~2,150 generated PNG tiles, committed
│
├── src/
│   ├── app/
│   │   ├── layout.tsx              # root layout; session init; ?reset=1 handling
│   │   ├── page.tsx                # HOME
│   │   ├── globals.css
│   │   ├── search/
│   │   │   └── page.tsx            # SEARCH RESULTS
│   │   ├── cart/
│   │   │   └── page.tsx            # CART
│   │   └── api/
│   │       └── recommend/
│   │           └── route.ts        # the ONLY server-side file
│   │
│   ├── components/
│   │   ├── AppHeader.tsx           # "Blinkit in 23 minutes", location line
│   │   ├── SearchBar.tsx
│   │   ├── CategoryGrid.tsx        # sections + tiles; dims non-searchable tiles
│   │   ├── ProductCard.tsx         # search result card with ADD / stepper
│   │   ├── CartLine.tsx
│   │   ├── BillDetails.tsx
│   │   ├── ViewCartBar.tsx         # sticky bottom bar
│   │   ├── SmartCartPanel.tsx      # container, skeleton, dismiss
│   │   ├── RecommendationRow.tsx   # one row: image, name, price, reason, ADD, Browse & Replace
│   │   └── BrowseReplaceSheet.tsx
│   │
│   └── lib/
│       ├── types.ts                # Product, Tile, Order, Event, RecommendResponse, PanelRow
│       ├── config.ts               # ALL tunable constants — see §7.4
│       ├── catalogue.ts            # load + index catalogue and tiles
│       ├── search.ts               # alias rewrite + Fuse.js setup + query()
│       ├── storage.ts              # typed localStorage get/set/clear
│       ├── cart.ts                 # cart read/write, subtotal, signature
│       ├── events.ts               # logEvent()
│       └── recommend/
│           ├── dormancy.ts         # tile classification from history
│           ├── shortlist.ts        # tile selection + candidate filtering + price ceiling
│           ├── prompt.ts           # prompt construction
│           ├── validate.ts         # model response validation
│           ├── fallback.ts         # deterministic panel
│           └── templates.ts        # template reason lines
│
├── .env.local                      # GROQ_API_KEY — gitignored
├── .env.example                    # documents required vars, committed
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 6. Build order

Nine phases. **Each phase is independently testable and must pass its test before the next begins.** Do not build ahead.

### Phase 0 — Data preparation

**0.1** Write `scripts/reduce_catalogue.py`. It reads `Blinkit_Products.xlsx` (27,555 rows) and writes `/data/catalogue.json`. In order: drop rows with null `product` or `brand`; drop duplicates on `(product, brand)`; drop rows with `sale_price` below ₹5 or above ₹5,000; map every `sub_category` to a tile id using an explicit dictionary at the top of the file (unmapped sub-categories are dropped and printed to console); sample each tile down to its `targetCount`, preferring rows whose brand appears most frequently in the source; assign sequential `id`s; assign `bestsellerRank` 1..n within each tile; set `isSearchable` and `isConsumable` from `tiles.json` with a per-tile override list.

> **Test:** run it. Console prints per-tile final counts and any shortfalls. `catalogue.json` has ~2,150 entries. No tile has fewer than 40 products except `ice-creams-more` and `beauty-cosmetics` (48 each, source-limited).

**0.2** Write `scripts/generate_images.py`. For every product, render a 400×400 PNG at `public/images/{id}.png`: flat background colour derived from the product's tile (one colour per tile, from a fixed palette), product name wrapped and centred in dark text, brand name smaller beneath.

> **Test:** `public/images/` contains one PNG per catalogue entry. Open five at random — text legible, colours differ by tile.

**0.3** Hand-author `/data/history.json` to the shape in §3.3.

> **Test:** write a throwaway Node script that loads history and catalogue, prints every tile with its classification and `mostRecentDaysAgo`. Confirm 5–6 active, 3–4 dormant, the rest never-bought, and that at least one dormant tile contains a durable the persona owns.

**0.4** Hand-author `/data/search-aliases.json` with 20–30 entries.

### Phase 1 — Scaffold and shell

**1.1** `npx create-next-app@latest smart-cart --typescript --tailwind --app --src-dir`. Delete boilerplate.
**1.2** Write `src/lib/types.ts` and `src/lib/config.ts` (§7.4) in full before any component.
**1.3** Write `src/lib/storage.ts` — typed localStorage wrapper, safe against SSR (`typeof window === 'undefined'` guard) and against corrupt JSON.
**1.4** Root layout: mobile-first, max-width 480px centred, session initialisation, `?reset=1` handling.

> **Test:** app runs at `/`, renders an empty shell. `?reset=1` clears localStorage and removes itself from the URL.

### Phase 2 — Catalogue and search

**2.1** `src/lib/catalogue.ts` — load catalogue and tiles, expose `getProduct(id)`, `getProductsByTile(tileId)`, `getTile(id)`, `getSections()`.
**2.2** `src/components/AppHeader.tsx` and `src/components/CategoryGrid.tsx`. Tiles grouped by section, 4 per row. **Tiles whose `searchable` is false render at 40% opacity with `pointer-events: none`.** No tile is clickable in v1.
**2.3** `src/components/SearchBar.tsx` — the only interactive element on Home. Navigates to `/search?q=...`.
**2.4** `src/lib/search.ts` — rewrite the query through `search-aliases.json`, then query Fuse.js over `isSearchable` products only. Fuse keys: `name` (weight 0.6), `brand` (0.3), tile label (0.1). Threshold 0.4. Cap at 40 results.
**2.5** `src/app/search/page.tsx` + `src/components/ProductCard.tsx`. Log `search` on every query.

> **Test:** search `maggi`, `colgat`, `cold drink`, `pedigree`. First three return sensible results. **`pedigree` returns nothing** — Pet Store is not searchable. That is correct behaviour, not a bug.

### Phase 3 — Cart

**3.1** `src/lib/cart.ts` — add, remove, setQuantity, subtotal, `cartSignature()`.
**3.2** ADD / stepper on `ProductCard`. Log `cart_add` with `source: "search"`.
**3.3** `src/components/ViewCartBar.tsx` — sticky bottom bar showing item count, navigates to `/cart`.
**3.4** `src/app/cart/page.tsx` with `CartLine` and `BillDetails`. No panel yet.

> **Test:** add three products across two tiles, navigate to cart, see them with a correct subtotal. Refresh — cart persists. `?reset=1` — cart empties.

### Phase 4 — Recommendation engine, deterministic path only

**No API key. No network. This phase produces a fully working panel.**

**4.1** `src/lib/recommend/dormancy.ts` — classify tiles from history, return `ownedProductIds`.
**4.2** `src/lib/recommend/shortlist.ts` — tile selection (§6 of the mechanism) and candidate filtering including the price ceiling.
**4.3** `src/lib/recommend/templates.ts` and `fallback.ts` — deterministic 4-row panel with template reason lines.
**4.4** `src/app/api/recommend/route.ts` — POST handler that runs 4.1→4.3 and returns the §4 Step 11 response shape with `source: "fallback"`.

> **Test:** `curl -X POST localhost:3000/api/recommend` with a hand-written cart body. Response has exactly 4 rows, slots `["A","A","B","B"]`, 4 distinct tiles, both B products priced at or below `max(100, subtotal × 0.5)`, and no dormant product that the persona owns and that is a durable. Vary the cart subtotal and confirm the B products change accordingly.

### Phase 5 — Panel UI

**5.1** `SmartCartPanel.tsx` — mount-time fetch, signature cache check, four-row fixed-height skeleton, dismiss control.
**5.2** `RecommendationRow.tsx` — image, name, price, reason line, ADD.
**5.3** Wire into `src/app/cart/page.tsx` between cart lines and Bill details.
**5.4** ADD behaviour: product to cart, row removed, no backfill. Removing that product from the cart restores the row.

> **Test:** cart page shows four rows. ADD removes a row and adds to cart without the Bill details block jumping. Remove from cart — the row returns. Navigate away and back with an unchanged cart — panel renders from cache with no network request in the devtools Network tab.

### Phase 6 — Model layer

**6.1** `npm install openai`. Configure the client with `baseURL: "https://api.groq.com/openai/v1"` and `apiKey: process.env.GROQ_API_KEY`.
**6.2** `src/lib/recommend/prompt.ts` — build the prompt per §4 Step 8.
**6.3** `src/lib/recommend/validate.ts` — per §4 Step 9, with per-entry replacement.
**6.4** Wire into the route: model call with a 4s `AbortController`, wrapped in try/catch, falling through to `fallback.ts` on any failure. Set `source` accordingly.

> **Test:** with a valid key, the response has `source: "model"` and reason lines that vary with cart contents. Then: (a) unset `GROQ_API_KEY` — panel still renders, `source: "fallback"`; (b) set `MODEL_TIMEOUT_MS` to 1 — panel still renders, `source: "fallback"`. Build a snacks-only cart and confirm the dormant pet product is a consumable that suits it, not the durable the persona already owns.

### Phase 7 — Browse & Replace

**7.1** `BrowseReplaceSheet.tsx` — bottom sheet reading `shortlists[row.tile]` from the cached response, excluding the displayed product.
**7.2** Selection swaps the row in place, preserving slot and position.

> **Test:** open the sheet on a slot-A row — it appears instantly with no network request. Replace. The row updates, remains slot A, and stays in the same position. ADD on the replacement adds the replacement.

### Phase 8 — Events

**8.1** `src/lib/events.ts` — `logEvent(type, payload)` appending to `sc_events`, capped at 500 entries (drop oldest).
**8.2** Add every call site from §3.6.

> **Test:** run a full flow — search, add two products, open cart, replace a row, add from the panel, dismiss. Inspect `sc_events` in devtools. Every event present, `panel_add` carries the correct `slot`, `recommend_call` carries a plausible `latencyMs` and the correct `outcome`.

### Phase 9 — Deploy

**9.1** Push to GitHub. **Confirm `.env.local` is gitignored.**
**9.2** Import into Vercel. Add `GROQ_API_KEY` as an environment variable.
**9.3** Deploy and test on the production URL from a phone.

> **Test:** on the deployed URL, a full flow completes. `recommend_call.outcome` reads `model`, not `fallback` — if it reads `fallback` in production but `model` locally, the key or the region is the problem, and finding that out now is the entire point of this test.

---

## 7. Environment and setup

### 7.1 Prerequisites

- Node.js 18.17+
- Python 3.10+ with `pandas`, `openpyxl`, `Pillow` (data scripts only)
- A GitHub account
- A GroqCloud account and API key from `console.groq.com` (no credit card required)

### 7.2 Environment variables

`.env.local`, gitignored:

```
GROQ_API_KEY=gsk_...
```

`.env.example`, committed:

```
GROQ_API_KEY=
```

`GROQ_API_KEY` is read **only** inside `src/app/api/recommend/route.ts`. It must never be referenced in a client component and must never be prefixed `NEXT_PUBLIC_`.

### 7.3 Local run

```bash
pip install pandas openpyxl Pillow
python scripts/reduce_catalogue.py
python scripts/generate_images.py
npm install
npm run dev
```

### 7.4 `src/lib/config.ts` — every tunable in one file

```ts
export const DORMANCY_THRESHOLD_DAYS = 30;
export const TENURE_MIN_DAYS = 180;

export const DORMANT_TILES_OFFERED = 3;
export const NEVERBOUGHT_TILES_OFFERED = 4;
export const SHORTLIST_SIZE = 12;

export const PRICE_CEILING_RATIO = 0.5;   // of cart subtotal
export const PRICE_CEILING_FLOOR = 100;   // rupees; no upper cap

export const MODEL_TIMEOUT_MS = 4000;
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_MODEL = "llama-3.3-70b-versatile";
export const MODEL_TEMPERATURE = 0.3;

export const SEARCH_THRESHOLD = 0.4;
export const SEARCH_MAX_RESULTS = 40;

export const EVENT_LOG_CAP = 500;
```

Nothing in this list may be hardcoded anywhere else in the codebase.

### 7.5 Groq operational notes

- Rate limits apply at the **organization level**, not per key. Extra keys do not raise them.
- The free tier caps requests per minute, tokens per minute, and requests per day simultaneously; **whichever is hit first returns HTTP 429.** Treat 429 as `fallback_ratelimit`, distinctly from other errors.
- Free-tier limits change. **Verify current values at `console.groq.com` before building** rather than trusting any figure quoted elsewhere.
- Groq serves open-weights models only, and the catalogue rotates as models are deprecated. `GROQ_MODEL` is pinned in `config.ts` so a deprecation is a one-line fix.
- Open-weights models follow strict JSON schemas less reliably than frontier models. Request JSON mode explicitly and expect to iterate on the prompt. The validation in Step 9 is what makes this safe.

---

## 8. Deferred

Not in v1. Do not build these. If one surfaces mid-build, add it here and continue.

| Item | Reason |
|---|---|
| Fatigue rule (5 consecutive ignores → suppress panel) | Requires five separate cart visits to observe. No evaluator will produce that. Event writes are in v1; the rule is not. |
| `/metrics` page | Built after the flow works end to end. Event writes ship in v1 so no session data is lost in the interim. |
| Holdout cohort | Cannot exist with one hardcoded user. Stays in the written PRD as measurement design. |
| Eligibility gate as a visible behaviour | Nothing to gate against with one user. Implemented as seed data (`accountAgeDays`, `segment`) and stated in the spec. |
| Bulk-add tick on panel rows | Cut in the idea doc. |
| Backfill after an add | Idea doc specifies no backfill in v1. |
| Trust signals — verified-seller marks, purchase counts, ratings | P1 in the idea doc. `rating` is deliberately dropped from the catalogue. |
| Struck-through original price on never-bought rows | P1, and gated on separating recommendation lift from discount lift. `mrp` is retained in the data but not rendered. |
| Reshuffle from the collapsed panel header | P1. |
| Persona switching / multiple seeded users | One hardcoded persona in v1. |
| Real product photography | Generated flat tiles in v1. |
| Real Blinkit catalogue, pricing, or API integration | Not obtainable. |
| Semantic or embedding-based search | Fuzzy matching handles the actual failure mode (typos). |
| Clickable category tiles / browse navigation | Search is the only entry path by design. |
| Paan Corner and Sexual Wellness tiles | Zero source rows. |
| Recompute on cart change | Deliberately rejected — panel stability outranks reactivity. |
| Aggregate cross-visitor analytics | Requires a hosted service; rejected with the database. |
