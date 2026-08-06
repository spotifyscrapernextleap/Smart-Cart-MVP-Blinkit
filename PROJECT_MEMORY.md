# Smart Cart — Project Memory

Single point of resource for handoff. Every phase appends its decisions, outcomes
and gotchas here. **If this project changes hands, this file plus
`phases/*/README.md` should be enough to continue without the original build
conversation.** Read this file top to bottom before touching anything.

---

## START HERE — current state

**All phases are complete, tested and deployed, plus a Phase 10 that is not in
the build spec.**

**Live: <https://smart-cart-mvp-blinkit.vercel.app>**

| Phase | State | Test result |
|---|---|---|
| 0 — Data preparation | ✅ committed | 12/12 persona checks |
| 1 — Scaffold and shell | ✅ committed | 12/12 storage |
| 2 — Catalogue and search | ✅ committed | 37/37 search |
| 3 — Cart | ✅ committed | 22/22 cart |
| 4 — Recommendation engine (deterministic) | ✅ committed | 76/76 recommend |
| 5 — Panel UI | ✅ committed | 11/11 panel cache |
| 6 — Model layer | ✅ committed | 80/80 model |
| 7 — Browse & Replace | ✅ committed | 71/71 replace |
| 8 — Events | ✅ committed | 45/45 events |
| **9 — Deploy** | ✅ **deployed** | `outcome: "model"` at 1482ms on the production URL |
| **10 — Checkout chrome** (beyond spec) | ✅ committed | 55/55 checkout |
| **11 — Supporting docs panel** (separate spec) | ✅ committed | 33/33 config + 4/5 links public |

**442 checks pass across the ten phase suites** (Phases 1–8, 10 and 11), **plus
12 in the Phase 0 data verifier** — 454 in total, the way the commands section
runs them. `tsc`, `eslint --max-warnings 0` and `next build` are all clean.

**The whole feature is now built.** Search *or* browse a category → add to cart
→ checkout → a four-row Smart Cart panel whose products and reason lines are
chosen by GPT-OSS 120B, each row swappable from its own shortlist with no second
network call, degrading to the deterministic panel on any model failure.
Measured round trip 1.3–2.0s against a 4s abort.

### The immediate next action

**There isn't one. The build is done.** The spec's final test passes on the
production URL: `recommend_call.outcome` reads `model` at 1482ms, not a
fallback. Repo: `github.com/spotifyscrapernextleap/smart-cart-mvp-blinkit`,
branch **`main`** (see the Phase 9 section — it was `master` for most of the
build).

**Phase 10 (beyond the spec)** rebuilt the cart page as a full Blinkit
checkout — special deal, suggestion grid, coupons, GSTIN, delivery
instructions, donation, tip, gifting, cancellation policy, and a sticky Place
Order bar — so the panel is judged in the context it would ship in. **The panel
did not move and cannot be crowded**: everything added sits above the basket or
below the bill, and the one section that recommends products draws only from
tiles already in the cart, which is exactly the set the panel excludes (D1a).
See [`phases/phase-10-checkout/README.md`](phases/phase-10-checkout/README.md).

**Phase 11 (a separate build spec)** adds the supporting-documents panel — a
dependency-free modal that opens once per page load and lists the research
artefacts as working links, because the submitted deck was exported through a
virtual PDF printer that stripped its hyperlinks. `src/disclaimer.config.js`
is **byte-identical to the other app's copy by contract — diff before
submitting.** Three deviations from its reference implementation were forced by
this repo, all recorded in
[`phases/phase-11-docs-panel/README.md`](phases/phase-11-docs-panel/README.md);
the important one is that the spec's mount effect is an eslint *error* here,
under the same rule that produced D21.

**Before any resubmission, run `node phases/phase-11-docs-panel/check_links.ts`** —
it fetches every link signed-out and inspects the body, because Google serves
HTTP 200 for its "Request access" wall. The Miro board cannot be verified this
way and needs a manual incognito check.

**The one thing still genuinely undone: nobody has looked at this app.**
Screenshots have failed in every single session — the browser pane never
composites, so `computer{action:"screenshot"}` times out. Every layout claim
in this file is a measured `getBoundingClientRect` or DOM text, never a human
or a rendered image. **Open the deployed URL on a real phone before showing
it to anyone.** That is the only outstanding risk, and it is a real one:
nothing here would have caught, say, a colour that fails contrast or a
reason line that collides with a price at 320px.

If you pick this up again, the likely work is: a visual pass, then the
deferred P1 items in spec §8 (struck-through `mrp`, the bulk-add tick) — both
of which were deliberately cut and have decisions explaining why (D28, D29).

---

## What this project is

A deployed web MVP reproducing the Blinkit shopping flow for one hardcoded
persona, with a new feature — **Smart Cart** — on the checkout page: four product
recommendations the user did not search for, split **2 dormant + 2 never-bought**,
each with a one-line reason.

**Governing documents:** [`smart-cart-build-spec.md`](smart-cart-build-spec.md) is
the literal build instruction — file paths, constant names and phase order come
from it. [`smart-cart-mvp-idea-doc.md`](smart-cart-mvp-idea-doc.md) is the product
rationale behind the rules. Where they conflict with each other or with reality,
the resolution is a numbered decision below.

**Companion register:** [`EDGE_CASES.md`](EDGE_CASES.md) — 60 identified failure
modes with severity, mitigation and owning phase. **57 closed, 1 withdrawn, 2
open, and every S1 is closed.** Each phase README states which it closed.

**Conventions**
- App lives at the repo root (not nested in `smart-cart/`), so `phases/`, `data/`,
  `scripts/`, `src/` and `public/` are siblings.
- Decisions are numbered `D<n>` and referenced from phase READMEs. **D1–D44 exist;
  the next new decision is D45.** Phase 11 implements a *separate* build spec and
  logs its deviations in its own README rather than as `D<n>`.
- A decision is logged when it departs from the spec, resolves an ambiguity in it,
  or would otherwise be invisible to whoever reads the code next.
- Every phase gets `phases/phase-N-name/` with a `README.md` and, where the logic
  is unit-testable, a `verify_*.ts` suite.

---

## Commands

```bash
npm run dev            # http://localhost:3000
npm run build          # must stay clean
npx tsc --noEmit
npx eslint src --max-warnings 0
```

Run every phase suite (all should print `N/N checks passed`):

```bash
node phases/phase-1-scaffold/verify_storage.ts
node phases/phase-2-catalogue-search/verify_search.ts
node phases/phase-3-cart/verify_cart.ts
node phases/phase-4-recommend/verify_recommend.ts
node phases/phase-5-panel-ui/verify_panel_cache.ts
node phases/phase-6-model/verify_model.ts
node phases/phase-7-browse-replace/verify_replace.ts
node phases/phase-8-events/verify_events.ts
node phases/phase-10-checkout/verify_checkout.ts
node phases/phase-11-docs-panel/verify_docs_panel.ts
node phases/phase-0-data/verify_history.js
```

`verify_model.ts` needs no key and makes no network call — it drives the real
validator with hand-written model responses.

Exercise the recommend route directly:

```bash
curl -s -X POST http://localhost:3000/api/recommend -H "Content-Type: application/json" -d '{"cart":[{"productId":"p_01163","quantity":1}]}'
```

**Rebuilding the seed data** — order is load-bearing, see gotcha A1:

```bash
python scripts/reduce_catalogue.py && rm -rf public/images && python scripts/generate_images.py && python phases/phase-0-data/author_history.py && node phases/phase-0-data/verify_history.js
```

`?reset=1` on any URL clears all four `sc_*` localStorage keys.

---

## Environment as built

| | |
|---|---|
| Node | v24.15.0, npm 11.16.0 |
| Next.js | 16.2.12 (App Router, Turbopack) |
| React | 19.2.4 |
| Tailwind | v4 (via `@tailwindcss/postcss`) — CSS-first, **no `tailwind.config.ts`** |
| TypeScript | 5 |
| Runtime deps | `next`, `react`, `react-dom`, `fuse.js`, `openai` (7.3, Groq-compatible client) |
| Python | **3.9.9** — spec asks for 3.10+ |
| Python packages | pandas 2.3.3, Pillow 10.2.0, openpyxl 3.1.5 |
| Git | branch **`main`** (was `master` until Phase 9 — D39), remote `github.com/spotifyscrapernextleap/smart-cart-mvp-blinkit` |
| Groq key | present in `.env.local` (gitignored, never committed — verified) |
| Model | **`openai/gpt-oss-120b`**, not the spec's Llama — see D32 |
| Free-tier limits (measured) | 1,000 requests/day, **8,000 tokens/minute** — tokens bind first |

---

## File map

```
data/                       committed seed data, read at build time
  tiles.json                27 tiles. Section order on Home comes from THIS file's order.
  catalogue.json            2,236 products. Ids are POSITIONAL — see gotcha A1.
  history.json              the persona: 40 orders, 244 line items
  search-aliases.json       35 single-word aliases (D15)
scripts/                    developer tools, never deployed
  Blinkit_Products.xlsx     source dump, 27,555 rows (a BigBasket export — D1)
  reduce_catalogue.py       → catalogue.json
  generate_images.py        → public/images/*.png (--force to regenerate)
public/images/              2,236 generated 400×400 PNGs, 18.8 MB, committed
src/lib/
  config.ts                 EVERY tunable. Nothing numeric may be hardcoded elsewhere.
  types.ts                  mirrors /data exactly; no seed file is read as `any`
  storage.ts                localStorage wrapper: SSR-safe, corrupt-safe, throw-safe
  session.ts                session id + ?reset=1
  catalogue.ts              loaders, indexed by id and tile (tile lists pre-sorted by rank)
  search.ts                 alias rewrite → Fuse.js → absolute relevance cutoff
  cart.ts                   add/remove/setQuantity/subtotal/cartSignature + sanitising
  cartActions.ts            cart mutations paired with their events. THE only place D22 lives.
  useCart.ts                useSyncExternalStore bindings (D21)
  events.ts                 logEvent, capped, trimmed on write
  panelCache.ts             sc_panel_cache, capped, stale-id aware
  recommend/
    dormancy.ts             tile classification + ownedProductIds + per-section counts
    shortlist.ts            tile selection, all four exclusions, price ceiling
    templates.ts            template reason lines
    fallback.ts             panel assembly, slot allocation, backfill
    prompt.ts               system prompt + the JSON payload sent to the model
    validate.ts             JSON extraction, per-entry validation, per-tile resolution
    replace.ts              what the sheet offers, and what a swap preserves
src/app/
  layout.tsx                480px shell, AppBootstrap
  page.tsx                  HOME
  search/page.tsx           SEARCH RESULTS
  cart/page.tsx             CHECKOUT — cart lines → SmartCartPanel → BillDetails
  category/[tile]/page.tsx  CATEGORY LISTING — static, one per BROWSABLE_TILES entry (D37)
  api/recommend/route.ts    THE ONLY SERVER-SIDE FILE. Only place GROQ_API_KEY is read.
                            Model call, 4s abort, every fallback route.
src/lib/checkout.ts         Phase 10. Cart-ADJACENT suggestions + bill arithmetic.
                            Draws only from tiles IN the cart — the exact
                            complement of what the panel draws from (D1a), which
                            is what stops it becoming a second discovery surface.
src/components/             AppHeader, SearchBar, CategoryGrid, ProductCard, ProductImage,
                            QuantityStepper, CartLine, BillDetails, ViewCartBar,
                            SmartCartPanel, RecommendationRow, BrowseReplaceSheet,
                            AppBootstrap
```

---

## The seeded persona

One hardcoded user, `u_dabbler_01`, `accountAgeDays: 247`, `segment: "dabbler"`.
No login, no persona picker. 40 orders / 244 line items spanning 1–212 `daysAgo`.

**`daysAgo` offsets, never absolute dates** — a history seeded in August would
otherwise be entirely dormant by November and the demo would silently break.

| Class | Count | Tiles |
|---|---|---|
| Active | 6 | `vegetables-fruits`, `atta-rice-dal`, `dairy-bread-eggs`, `chips-namkeen`, `drinks-juices`, `instant-food` — all ordered within 2 days |
| Dormant | 4 | `cleaners-repellents` (38d), `pet-store` (49d), `bakery-biscuits` (67d), `tea-coffee-milk-drinks` (103d) |
| Never-bought | 17 | everything else |

Orders per **section** — the basis of never-bought tile ordering (D23):

| Section | Orders |
|---|---|
| Beauty & Personal Care | **0** |
| Household Essentials | 5 |
| Pet Store | 5 |
| Snacks & Drinks | 42 |
| Grocery & Kitchen | 97 |

**Two anchor products make the rules observable — do not break these:**

- **`p_02159`** "Padded Harness", `pet-store`, **non-consumable**, rank 6, owned by
  the persona. Must never appear as a dormant candidate. It sits inside the
  12-item shortlist so its absence is visible rather than incidental.
- **`p_02161`** dog food, `pet-store`, **consumable**, bought 3 times. Must
  continue to appear — re-suggesting a lapsed staple is the intended behaviour,
  and the contrast with the harness is the whole point of `isConsumable`.
- `p_01937` compostable garbage bags, bought 4 times then nothing for 38 days, is
  the lapsed-staple case in `cleaners-repellents`.

---

## Invariants that must never break

Every one of these is enforced by code, not by the model, and each has a test.

1. The panel renders **exactly four rows**, ordered A, A, B, B.
2. All four rows come from **four different tiles**.
3. **Slot A = dormant, slot B = never-bought.** If a type cannot supply two, the
   panel backfills from the other type and the row reports the slot it *actually
   is*, never the position it occupies (D14).
4. **No slot-B product exceeds** `max(100, subtotal × 0.5)`. Filtered before the
   model ever sees a candidate.
5. **A durable the persona already owns is never a dormant candidate.**
   Consumables they own are *not* excluded.
6. **Nothing already in the cart is recommended** — neither the product (D1) nor
   its tile (D1a).
7. **Never-bought reason lines claim no purchase history.** See the `CLAIMS_HISTORY`
   gotcha under Phase 4 — do not implement this by banning the word "you".
7a. **Dormant reason lines name the tile, never the product.** The product on a
   dormant row is chosen by bestseller rank and is usually not one the persona
   ever bought, so "you used to order this" is false — even though the build
   spec's own example response contains exactly that line. Enforced by requiring
   the tile label to appear in the line. (E10)
8. **The panel does not recompute while the user is on the page.** Computed once
   on mount, cached by cart signature.
9. **`GROQ_API_KEY` is readable only inside `src/app/api/recommend/route.ts`**, and
   never prefixed `NEXT_PUBLIC_`.
10. **Every tunable lives in `config.ts`** and is hardcoded nowhere else — including
    CSS, which receives `PANEL_ROW_EXIT_MS` as an inline custom property rather
    than duplicating the number.

---

## Constants (`src/lib/config.ts`)

Spec §7.4 verbatim: `DORMANCY_THRESHOLD_DAYS` 30 · `TENURE_MIN_DAYS` 180 ·
`DORMANT_TILES_OFFERED` 3 · `NEVERBOUGHT_TILES_OFFERED` 4 · `SHORTLIST_SIZE` 12 ·
`PRICE_CEILING_RATIO` 0.5 · `PRICE_CEILING_FLOOR` 100 · `MODEL_TIMEOUT_MS` 4000 ·
`GROQ_BASE_URL` · `MODEL_TEMPERATURE` 0.3 ·
`SEARCH_THRESHOLD` 0.4 · `SEARCH_MAX_RESULTS` 40 · `EVENT_LOG_CAP` 500

One spec value changed: **`GROQ_MODEL` is `openai/gpt-oss-120b`**, not
`llama-3.3-70b-versatile` (D32).

Added beyond the spec, in a marked section (D10): `SEARCH_MAX_SCORE` 0.35 (D16) ·
`MIN_CART_QUANTITY` 1 / `MAX_CART_QUANTITY` 99 (C5) ·
`MAX_TILES_PER_SECTION_OFFERED` 2 (D23) · `PANEL_CACHE_MAX_ENTRIES` 20 (C7) ·
`PANEL_ROW_EXIT_MS` 220 (F2) · `MODEL_REASONING_EFFORT` "low" (D32) ·
`MODEL_MAX_COMPLETION_TOKENS` 1024 (D32) · `MODEL_SHORTLIST_DEPTH` 6 (D33) ·
`REASON_MAX_CHARS` 100 / `REASON_MAX_WORDS` 8 (spec prose, made constants) ·
`SHEET_ENTER_MS` 200 (D10) · `BROWSABLE_TILES` 9 tiles (D37)

Phase 10 checkout chrome, all presentational and none read by `/api/recommend`:
`DELIVERY_FEE_ORIGINAL` 30 · `HANDLING_CHARGE` 12 · `DONATION_OPTIONS` [5,10,15] ·
`DONATION_MEAL_AMOUNT` 15 · `TIP_OPTIONS` [20,30,50] · `SUGGESTED_PRODUCT_COUNT` 6 ·
`SUGGESTED_STAR_RATING` 4 (D40) · `SPECIAL_DEAL_MAX_PRICE` 150

---

## Testing conventions

- **No test runner, by design.** Node 24 executes TypeScript natively, so suites
  import and exercise **real source** with no build step and no dependency the
  spec did not authorise. This is why `src/lib` value imports carry explicit
  `.ts` extensions (D18) — Node resolves ESM by exact path and ignores tsconfig
  `paths`.
- **Faking the browser:** set `globalThis.window = { localStorage: fake }` before
  calling anything that touches storage. `verify_storage.ts` and `verify_cart.ts`
  both show the pattern.
- **A test that cannot fail proves nothing.** `verify_recommend.ts` self-tests its
  own `CLAIMS_HISTORY` detector against 9 must-reject and 4 must-accept lines,
  because the first version passed everything.
- Suites are additive: a later phase never edits an earlier suite except to
  correct a stale expectation, which is then noted in that phase's README.

---

## Phase 0 — Data preparation

**Completed.** All four sub-phase tests pass. Detail and reproduction steps in
[`phases/phase-0-data/README.md`](phases/phase-0-data/README.md).

Outputs: `data/tiles.json` (27), `data/catalogue.json` (2,236), `data/history.json`
(40 orders / 244 line items), `data/search-aliases.json` (36), `public/images/`
(2,236 PNGs).

### Decisions

**D1 — Source data is BigBasket-shaped, and the mapping is explicit.**
`Blinkit_Products.xlsx` is a BigBasket dump: categories read *Beauty & Hygiene*,
*Kitchen, Garden & Pets*. Its 27,555 rows and 8,626 null ratings match the spec's
stated figures exactly, so this is the file the spec was written against. All 90
distinct `sub_category` values are mapped to a tile in `SUBCATEGORY_TO_TILE` at the
top of `scripts/reduce_catalogue.py`; **none are dropped**. A handful of names
appear under more than one category (`Atta, Flours & Sooji` under four), but every
collision resolves to the same tile, so `sub_category` alone is a sufficient key.
There is deliberately no fallback bucket — a silently mis-binned sub-category would
corrupt dormancy, never-bought and diversity logic, which all operate on tiles.

**D2 — Brand sampling took three attempts; the first two produced unusable catalogues.**
The spec says to sample each tile "preferring rows whose brand appears most
frequently in the source". Read literally that is a flat sort, and it fails:

| Attempt | Result |
|---|---|
| Flat top-N by global brand frequency | Whole tiles collapse to one brand — 90 Fresho vegetables, 120 bb Royal staples, 70 INATUR skincare. The most frequent brands in this dump are BigBasket private labels, precisely because private labels span the widest SKU range. Browse & Replace would show twelve near-identical products. |
| Round-robin across all brands | The opposite failure — every product a different brand, so searching `maggi` returns exactly one result. |
| **Per-tile frequency + bounded brand set, round-robin** | Adopted. ~`target/3` brands per tile, taken in frequency order, filled round-robin. |

Two things had to change together. Frequency is now counted **within the tile's own
pool**, not across the whole dump: counted globally the winners are whichever brands
carry the widest range overall, so Maggi — 12th inside instant food, nowhere near the
top globally — was dropped from the catalogue entirely and the spec's own Phase 2
search test could not have passed. And the brand set is **capped** at roughly
`target / TARGET_PRODUCTS_PER_BRAND` (3), so each brand contributes a few SKUs.
Result: Maggi, Amul, Britannia, Tata, Tropicana, Surf, Dettol, Nescafé and
Haldiram's are all present and searchable, at 16–40 brands per tile.

**D3 — Strip whitespace before deduping and counting.**
The source has trailing spaces on some brand values (`"MAGGI "`, `"Haldirams "`).
Left alone, one brand counts as two and its apparent frequency halves — which,
combined with D2, is enough to drop it from a tile. Trimming happens immediately
after the null drop, before both the `(product, brand)` dedup and the brand counts.

**D4 — `Drinks & Beverages` files under `tea-coffee-milk-drinks`, not `drinks-juices`.**
Of its 736 rows, 335 are gourmet tea, 157 coffee and 80 health drinks — 78%. Sent to
`drinks-juices` it drowned the juice tile in loose-leaf Darjeeling; the first build
had `drinks-juices` leading with TGL Co., Te-A-Me and Karma Kettle. After the remap
`drinks-juices` leads with Real, Tropicana, Paper Boat and B Natural, and
`tea-coffee-milk-drinks` leads with TGL Co. and VAHDAM. Both tiles now read as
their label.

**D5 — `Oral Care` files under `health-pharma`, which makes the spec's `colgat` test unsatisfiable.**
> ⚠️ **SUPERSEDED BY D12.** Every product is searchable now, so `colgat` returns
> real results and this conflict no longer exists. `Oral Care` remains filed under
> `health-pharma`. Kept for the reasoning only — **do not act on it.**

Colgate exists only in `Oral Care` (271 source rows). Every tile in the Beauty &
Personal Care section is `searchable: false` per the spec's own tile table, and the
spec provides no oral-care tile. So `Oral Care` cannot land anywhere searchable
without altering the tile table — yet the Phase 2 test says *"search `maggi`,
`colgat`, `cold drink`, `pedigree`. First three return sensible results."*

Resolved in favour of the tile table, because the table is load-bearing for the
feature and the specific test word is not: the test's purpose is typo tolerance,
which any brand demonstrates. `maggi`, `cold drink` and `pedigree` all behave
exactly as specified. **Phase 2 will substitute a searchable brand for the typo
test** — `britania`/`amull`/`tropicanna` are the candidates.

The alternative — flipping `health-pharma` to `searchable: true` — is a one-line
change if preferred, but it shrinks the never-bought pool and makes oral care
reachable by search, which is the thing the demo is built to prevent.

**D6 — `history.json` is authored by a script that lives in the phase folder.**
The spec calls this file hand-authored, and every structural choice in it is a
design decision, not a sample. But ~200 line items must reference real catalogue
ids, and ids shift whenever the catalogue is rebuilt — so the design is encoded in
`phases/phase-0-data/author_history.py` and regenerated deterministically
(`SEED = 20260802`). It is **not** in `scripts/` because the spec specifies that
directory as containing exactly two files.

**D7 — Never-bought tile ranking is degenerate. A Phase 4 problem, flagged now.**
> ✅ **RESOLVED BY D23** — ordered by the persona's per-section order count.
> Kept for the reasoning only.

Spec Step 6 selects never-bought tiles by "`bestsellerRank` of their top product
ascending". Every tile's top product has rank 1, so all 17 never-bought tiles tie
and the selection collapses to whatever order the array happens to be in — which
would offer `oil-ghee-masala`, `dry-fruits-cereals`, `chicken-meat-fish` and
`kitchenware-appliances`. Three of those are ordinary grocery. The feature exists to
surface Beauty & Personal Care, Electronics and Pet Store, and this ordering
surfaces none of them. **Phase 4 must choose a meaningful tie-break** and log it.

### Gotchas

- **Product ids are positional.** `p_00001`..`p_02236` are assigned in tile order
  after sampling, so any catalogue change reshuffles them and silently invalidates
  `public/images/` *and* `data/history.json`. Rebuild order is always:
  `reduce_catalogue.py` → delete `public/images/` → `generate_images.py` →
  `author_history.py` → `verify_history.js`. This bit twice during Phase 0.
- **Dormant runs are indexed from the lapse day.** In `author_history.py` the
  eligible-days list is sorted ascending, so index 0 *is* the most recent order.
  The first cut of the scheduling condition read it as oldest-first and produced
  dormancy at 155–178 days, outside the spec's 35–120 window. The verifier caught it.
- **`cola` matches "cho-cola-te".** There are no soft drinks in this dataset at all,
  so the spec's example alias `cold drink → soft drinks` returns nothing. Retargeted
  to `juice` (27 hits). Every one of the 36 aliases was checked against the
  searchable catalogue; there are no dead targets.
- **Python 3.9, not 3.10+.** pandas and Pillow are fine on it, so no upgrade was
  forced, but the scripts avoid `match` statements and `X | Y` runtime unions.
- **`mrp` is populated but must not be rendered in v1** (spec §8) — it is reserved
  for struck-through pricing, which is explicitly deferred.

---

## Phase 1 — Scaffold and shell

**Completed.** Spec test passes in-browser; storage suite passes 12/12. Detail in
[`phases/phase-1-scaffold/README.md`](phases/phase-1-scaffold/README.md).

Closed edge cases **C1** (hydration), **C3** (storage unavailable), **C4** (corrupt
values), **C6** (`?reset=1` history).

### Decisions

**D8 — Scaffolded through a temp directory, not in place.**
`create-next-app` refuses a non-empty target, and the repo root already held
`data/`, `scripts/`, `phases/` and 2,236 committed images. Scaffolding into the
scratchpad and copying only `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`,
`eslint.config.mjs`, `package.json` and the lockfile avoided any chance of the
generator touching `public/`. `node_modules` was not copied; `npm install` ran at
the root instead. The scaffold's `public/*.svg`, `README.md`, `AGENTS.md` and
`CLAUDE.md` were deliberately not brought over.

**D9 — Tailwind v4, so there is no `tailwind.config.ts`.**
`create-next-app@latest` now ships Tailwind 4, which is CSS-first: configuration
lives in an `@theme` block in `globals.css` and PostCSS runs `@tailwindcss/postcss`.
The build spec's §5 file tree lists a `tailwind.config.ts` that this version does
not produce. Cosmetic divergence, no behavioural effect. Next 16 likewise satisfies
the spec's "Next.js 14+".

**D10 — New tunables go into `config.ts` under a marked section, never inline.**
At Phase 1 the file was byte-for-byte the spec's §7.4. Several edge-case
mitigations later needed constants the spec did not anticipate; each was added
below a `Beyond build spec §7.4` marker rather than hardcoded at its call site,
because the file's stated contract is that it holds **every** tunable. Six have
since been added — see the Constants section near the top of this file.

This contract extends to CSS, which cannot import TypeScript: `PANEL_ROW_EXIT_MS`
is passed into `globals.css` as an inline custom property by `SmartCartPanel`
rather than duplicated as a literal in the stylesheet.

**D11 — Storage guards are shallow and heal lazily.**
`isCartLines` and friends check enough structure to prevent a crash, not enough to
prove correctness — domain validation belongs where the domain rules live (Phase 3's
`cart.ts` is what drops ids missing from the catalogue, per C2). Guards run **on
read**, so a corrupt key stays on disk until something reads it; a bad value is
cleared at that point so it cannot fail twice. Observed live: `sc_cart` was still
`[[[` after a reload because nothing reads the cart until Phase 3. That is intended,
and worth knowing before someone reports it as a bug.

### Gotchas

- **`storage.ts` probes rather than trusts.** Safari private mode exposes
  `window.localStorage` and *then* throws on use, so `getStore()` performs a
  write-and-remove probe on every access instead of checking for existence. The
  hostile-storage test in `verify_storage.ts` fails without this.
- **Node 24 runs TypeScript natively**, which is how the storage suite tests real
  source with no test-runner dependency. `node phases/phase-1-scaffold/verify_storage.ts`
  just works. Worth reusing for later phases.
- **Reset order is load-bearing.** `AppBootstrap` calls `handleResetParam()` before
  `getSession()`. Reversed, the reset wipes a session that was created microseconds
  earlier and immediately re-creates it — the clear appears to do nothing.
- **`?reset=1` regenerates the session rather than leaving `sc_session` empty.**
  Correct behaviour, but it means "all four keys are null" is the wrong assertion
  for that test; three are null and the fourth holds a *new* id.
- **`src/app/page.tsx` is a diagnostic placeholder** that prints session and key
  state. Phase 2 replaces it wholesale with Home. Do not build on it.

---

## Interlude — three product decisions, taken before Phase 2

These were the open items carried out of Phase 0. All three were decided by the
project owner. **D12 supersedes D5 and materially changes the spec**, so the
reasoning is recorded in full rather than summarised.

**D12 — Every product is searchable and addable. Supersedes D5.**

The build spec gates search on `isSearchable` and calls it "**the mechanism of
the demo** — without it the user could find the 'undiscovered' categories by
searching" (§3.2). Its Phase 2 test states that `pedigree` returning nothing is
"correct behaviour, not a bug".

**That gate is now removed.** All 27 tiles are `searchable: true`; all 2,236
products are searchable and addable. A query that matches nothing returns an
explicit *"Not available here"* state.

Rationale, in the owner's framing: an evaluator will probe the app with many
different categories, and it has to behave like a real store under that probing.
An evaluator who searches `shampoo` and gets nothing concludes the app is broken,
which destroys the demo faster than a weakened premise does.

Worth recording that this is **better aligned with the idea doc than the spec
was.** Finding H2 is that users "do not actively refuse these categories, they
simply do not consider Blinkit for them" — a behavioural barrier, not a capability
one. Blocking search simulated the symptom. Leaving search open and watching the
panel still do the work demonstrates the actual mechanism: the user *could* have
found pet food, did not think to, and the cart page surfaced it anyway.

The cost, stated plainly: the panel can no longer claim it is showing something
otherwise unreachable. It is showing something the user did not think to look for.
That is a weaker claim, and a truer one.

**D12a — The panel must read the cart. The direct consequence of D12.**

Because Pet Store is now searchable, the obvious evaluator gesture is: search
`pedigree` → add dog food → open cart. If the panel then offers more Pet Store as
a dormant *reactivation*, it is nonsense — the category was reactivated thirty
seconds ago — and it looks like the panel is not reading the cart at all.

Rule: **every tile represented in the cart is excluded from candidate selection**,
dormant and never-bought alike; the next-ranked tile of that type takes its place.
Adding dog food should move the dormant slots to `bakery-biscuits` and
`tea-coffee-milk-drinks`.

This does **not** conflict with the spec's deliberate rejection of "recompute on
cart change". The panel is still computed once on cart-page mount and cached by
signature; nothing reshuffles while the user is reading it. Adding dog food changes
the signature, so the *next* visit computes a fresh panel. Stability within a visit
is preserved; responsiveness across visits is gained. Tracked as edge case D1a.

**D13 — `bestsellerRank`: 3 random bestsellers per tile.**

Per tile, `BESTSELLER_COUNT` (3) products are drawn with a seeded RNG and take
ranks 1–3; the rest follow in brand-frequency order from rank 4. The source dump
has no popularity column, so every ranking here is a fiction — this one at least
stops the fallback panel leading with the same product on every single run.

Crucially, rank is now assigned **independently of selection order**. Product ids
still follow selection order, so changing the ranking scheme does not reshuffle
ids. This was verified: after the change, all 2,236 ids point at the same products,
`public/images/` needed no regeneration, and every id in `history.json` stayed
valid. Only 1,736 rank values moved.

Known limitation, accepted when the option was chosen: this does **not** fix the
tile-ordering tie in edge case D6. Every tile still has a rank-1 product, so
ordering never-bought *tiles* by their top product's rank still ties 17 ways. A
tie-break is still required in Phase 4.

**D14 — Slot backfill approved.** The panel always renders 4 rows. If a slot type
cannot supply 2, backfill from the other type. Every row and every event reports
the slot the row **actually is**, never the position it sits in — otherwise
slot-level metrics, which the idea doc names as the feature's main defence against
its own most likely failure mode, become fiction. Tracked as edge case D2.

### Consequences already absorbed

- `data/tiles.json` — 10 tiles flipped to `searchable: true` (`kitchenware-appliances`,
  `bath-body`, `hair`, `skin-face`, `beauty-cosmetics`, `feminine-hygiene`,
  `baby-care`, `health-pharma`, `electronics`, `pet-store`).
- `data/catalogue.json` — rebuilt. 2,236 products, **1,558 → 2,236 searchable**,
  recommend-only now 0. Ids unchanged; images untouched.
- `data/history.json` — re-authored, since repertoire selection reads rank.
  Verifier still passes 12/12; the owned durable `p_02159` moved from rank 3 to
  rank 6, still inside the 12-item shortlist, so the exclusion rule stays observable.
- `EDGE_CASES.md` — B1 withdrawn, B1a and D1a added, B4/B5/D2/D6 rewritten.
- **The spec's Phase 2 test changes.** `pedigree` and `colgat` now both return
  results. The typo-tolerance check still holds; the "returns nothing" assertion
  does not.
- `isSearchable` survives in the data model as a vestigial field. Spec §3.2
  requires it, it costs nothing, and keeping it is what makes D12 cheap to revert.
- **`CategoryGrid` no longer dims anything.** Spec 2.2 dims tiles whose
  `searchable` is false; none are. Tiles remain inert — no tile is clickable in v1.

---

## Phase 2 — Catalogue and search

**Completed.** Spec test passes in-browser; verification suite passes 37/37.
Detail in [`phases/phase-2-catalogue-search/README.md`](phases/phase-2-catalogue-search/README.md).

Closed edge cases **A2** (missing image), **A3** (duplicate names), **A4** (long
names), **B1a** (not-available state), **B2** (alias word boundaries), **B3**
(empty query), **B4** (coverage), **B5** (min length), **B6** (long query), **B7**
(result cap), **H1** (no `next/image`).

### Decisions

**D15 — Alias values must be a single word. This is a hard constraint, not a style preference.**
Fuse matches the query as **one fuzzy pattern**, so an alias that expands a word
into a phrase produces a string resembling no product name. `dal` →
`"dal pulses lentil"` returned **zero** results; so did `maida`, `namkeen` and
`matchbox`. Measured across the whole map: single-word values returned 25–40
results, multi-word values 0–4.

All 35 aliases are now single-word, and `verify_search.ts` asserts it so the
constraint cannot be violated silently later. Several aliases were **deleted**
rather than rewritten, because the native term already worked better — unaliased
`atta` leads with "Khapli Atta" instead of generic flour, and `poha`, `besan`,
`namkeen`, `biscuit`, `dal` behave the same way.

Two entries were also removed as dishonest: `sanitizer` and `lipstick` are not in
the catalogue at all, so "Not available here" is the correct answer and an alias
pointing them elsewhere would have been a lie dressed as coverage.

**D16 — Search relevance needs an ABSOLUTE cutoff, not a relative one.**
`SEARCH_THRESHOLD` (0.4) bounds each per-key match, but Fuse's weighted total can
exceed it, so the result list ran to 40 rows of noise: `maggi` matched 146
products of which three were MAGGI.

The first fix was a band relative to the best hit. It fixed `maggi` and did
nothing for `iphone`, which still returned 40 rows of honey and hair conditioner
— **when every match is bad, the best match is bad too, and the entire tail sits
inside the band.** A relative cutoff structurally cannot reject a query the
catalogue has no answer for.

`SEARCH_MAX_SCORE = 0.35` is absolute, and sits in a wide empty gap in the
measured distribution:

| | best score |
|---|---|
| Answerable (`maggi`, `pedigree`, `milk`, `dog food`) | 0.00 – 0.21 |
| Unanswerable (`petrol`, `iphone`, `mattress`, `furniture`) | 0.52 – 0.79 |

The counterweight is in the suite too: `condoms` (0.05) and `beer` (0.18) are
genuinely stocked and must keep returning results. New constant, so it lives in
`config.ts` under the "Beyond build spec §7.4" section per D10.

**D17 — `events.ts` ships in Phase 2, not Phase 8.**
Spec 2.5 requires logging `search`, which requires `logEvent`. §3.6 is explicit
that retrofitting event calls into finished components is the expensive part.
Phase 8 now adds the remaining call sites and verifies the full set rather than
building the module from scratch.

**D18 — Lib modules use explicit `.ts` extensions on value imports.**
Node resolves ESM by exact path and does not read `tsconfig` `paths`. Extensions
on the six relative value imports inside `src/lib` — plus
`allowImportingTsExtensions` and `with { type: "json" }` on the seed imports —
let `node phases/*/verify_*.ts` run against **real source** with no test runner
and no build step. Both Turbopack and `tsc` accept it. Type-only imports are
erased before Node sees them and need no extension.

### Gotchas

- **The catalogue had mojibake in 15 names** — `DentastixÂ Dog Treat`. The source
  was written UTF-8 and read back as a single-byte codec, so a non-breaking space
  arrives as the two characters `Â\xa0`; removing the invisible half leaves the
  visible half on screen *and burnt into the generated product image*. Repair
  reverses the round-trip, tries **cp1252 before latin-1** (`â€“` only reverses
  under cp1252, whose 0x80–0x9F block holds the dashes latin-1 leaves undefined),
  and loops up to `MAX_MOJIBAKE_PASSES` because a few rows were damaged twice.
  Images were regenerated with `--force`; ids did not move.
- **Implicit form submission needs a submit control.** The search input alone did
  not submit on Enter under automation. A visually hidden `type="submit"` button
  now guarantees it for hardware Enter and the mobile keyboard's search key.
- **Verify events after a full page load, not immediately after navigation.** The
  `search` event is written in an effect, so reading `sc_events` too quickly shows
  an empty log and looks like a logging bug. Confirmed exactly **one** event per
  search — no React StrictMode double-fire (relevant to edge case G1).
- **`getSections()` order comes from `tiles.json`**, not from code. Reordering
  sections on Home means reordering that file.
- **Browser-pane screenshots were unavailable** this session (the pane was not
  displayed, so nothing composites). Layout was verified numerically instead —
  shell width, grid column count, `document.body.scrollWidth` — plus
  `get_page_text` for content. Worth a visual pass before deploy.

---

## Phase 3 — Cart

**Completed.** Spec test passes live (3 products / 2 tiles / correct subtotal /
survives refresh / empties on reset); verification suite passes 22/22. Detail
in [`phases/phase-3-cart/README.md`](phases/phase-3-cart/README.md).

Closed edge cases **C2** (stale cart ids healed on read), **C5** (quantity
clamp), **F8** (safe-area-inset-bottom on the sticky bar).

### Decisions

**D19 — `cart.ts` never caches; every read goes through storage and re-sanitises.**
Unlike `catalogue.ts` (static import, immutable for the life of the process),
the cart can be mutated by the user at any time and must reflect a catalogue
that might have been rebuilt since the page loaded (edge case A1: product ids
are positional and rebuilds are frequent during this build). A module-level
cache would risk serving a snapshot that no longer matches either storage or the
catalogue. `getCart()` re-reads and re-validates on every call; the cost is one
JSON parse and a linear scan over a cart of a handful of items, which is free.

**D20 — Stale ids are healed on read, not just filtered for display.**
`getCart()` drops any `productId` the catalogue no longer has (C2) and, if that
changed anything, **rewrites storage** with the cleaned list — silently, no
event, since healing a corrupted value isn't a user action. Verified directly:
seeded storage with one good line and one line for an id the catalogue doesn't
have, called `getCart()`, and confirmed both the returned value *and the
underlying storage* were clean afterward. Without the storage rewrite, the same
stale id would be re-read (and re-dropped) on every subsequent call forever.

**D21 — `useSyncExternalStore`, not hand-rolled `useEffect` + `useState`.**
The first draft of `useCart.ts` read the cart in a `useEffect` and called
`setState` directly in the effect body — the standard-looking pattern for
"hydrate from a client-only source after mount" that the rest of this codebase
already uses elsewhere for SSR safety. `eslint-plugin-react-hooks`' newer
`react-hooks/set-state-in-effect` rule flagged both call sites as errors.

Two ways to make the error go away were considered and rejected:

- **Lazy `useState` initializer** (read storage as the initial state instead of
  in an effect) — this would run during the *hydration* render pass, which
  happens in the browser where `window` exists, while the *server*-rendered
  HTML has no window and shows empty/zero. That reintroduces the exact
  hydration mismatch (C1) the effect-based approach exists to avoid. Rejected.
- **Wrap the same code in a named function and call it** — satisfies the
  linter's pattern-match without changing the underlying behaviour or timing.
  Correctly identified as lint theater and rejected.

`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` is the actual
tool React ships for this problem and has no such issue: it is a React built-in
(not a state library, per the spec's exclusion list), and its
`getServerSnapshot` parameter *is* the sanctioned way to say "empty on the
server, real value on the client" without a manual effect. The one requirement
it imposes — `getSnapshot` must return a referentially stable value when
nothing changed, or it re-renders in a loop — is satisfied for the `lines`
array via a small cache in `cart.ts` (`getCartSnapshot()`, keyed on the
serialised value) and needs no such handling for `useCartQuantity`, since a
`number` compares by value.

**D22 — `cart_add`/`cart_remove` fire only on the 0↔1 transition, not on every tap.**
Spec §3.6 gives `cart_add` a `source: "search" | "panel"` field but never says
whether it fires per-tap or per-entry, and never anticipates a third surface —
the cart page's own stepper — which is neither "search" nor "panel". Decided by
extension of the spec's own stated principle for `slot` on panel events ("load-
bearing... aggregate numbers are useless"): `cart_add.source` exists to
attribute which channel a product entered through, so logging it again on a
later "+" tap would misattribute a pure quantity bump as a fresh conversion and
inflate that channel's numbers for nothing. `cart_remove` is scoped
symmetrically for the same reason, and has no source-ambiguity problem to begin
with. Concretely:

- `cart_add` logs only on quantity 0 → ≥1 (a product entering the cart). This
  can only happen from `ProductCard`'s ADD button, never from `CartLine` (which
  only ever renders for a product already at quantity ≥1).
- `cart_remove` logs only on quantity ≥1 → 0 (a product leaving the cart),
  whichever control triggered it.
- Every other tap — increment above 1, decrement that stays above 0 — mutates
  the cart but logs nothing.

Verified live: one ADD → one `cart_add`. Two subsequent "+" taps (quantity
1→2→3) → still exactly one `cart_add`, zero `cart_remove`. A "−" tap that
leaves quantity at 2 → still zero `cart_remove`. The final "−" to 0, from the
*cart page's* stepper → exactly one `cart_remove`, line removed, empty state
rendered.

### Gotchas

- **Stopping and restarting the dev server does not necessarily clear a
  browser tab's stale bundle.** After renaming `SEARCH_RELEVANCE_BAND` to
  `SEARCH_MAX_SCORE` (Phase 2, already committed), one long-lived preview tab
  kept reporting the old export was missing — even after `preview_stop`,
  deleting `.next`, and a fresh `preview_start`. The disk, `tsc`, `eslint`, and
  `next build` were all already clean; the error was coming from the *tab's own
  cached module graph*, not the server. A brand-new tab (`tabs_create`) loaded
  correctly on the first try. If a browser-pane error contradicts a clean build,
  open a fresh tab before spending time chasing a phantom bug.
- **`read_page`'s `interactive` filter can silently truncate or omit content**
  on a page with many results (e.g. 33 amul results) — it reported "(empty
  page)" once even though `get_page_text` showed full content and no console
  errors existed. Cross-check with `get_page_text` or the `all` filter before
  concluding a page failed to render.
- **Coordinate-based `computer` clicks on `ref_N` intermittently missed their
  target** in this session after a viewport resize — clicks landed but the
  cart never changed, with no console error. Confirmed the underlying button
  and handler were correct by dispatching `.click()` on the DOM node directly
  via `javascript_tool`, which worked every time. Prefer direct `.click()` over
  coordinate clicks when verifying logic, not pixel-perfect hit-testing.
- **React state updates from a click are not visible in the same synchronous
  read.** Capturing `innerText` in the same `javascript_exec` call as the
  `.click()` that triggers it can observe the pre-update DOM. Re-read in a
  separate call after the click.

---

## Phase 4 — Recommendation engine, deterministic path

**Completed.** Spec test passes via `curl`; verification suite passes 76/76.
Detail in [`phases/phase-4-recommend/README.md`](phases/phase-4-recommend/README.md).

Closed edge cases **D1** (cart products excluded), **D1a** (cart tiles excluded),
**D2** (slot backfill), **D3** (owned durable excluded), **D4** (price ceiling
applied before the model), **D5** (tile diversity by construction), **D6**
(never-bought ordering — see D23 below), **D8** (empty cart renders), **D9**
(shortlist exhaustion falls through to the next tile).

### Decisions

**D23 — Never-bought tiles are ordered by the persona's per-SECTION order count. This resolves D6.**

Spec §4 Step 6 says to sort never-bought tiles by "`bestsellerRank` of their top
product ascending". Every tile has a rank-1 product, so that key ties all
seventeen ways and collapses to `tiles.json` array order — which offers
`oil-ghee-masala`, `dry-fruits-cereals`, `chicken-meat-fish` and
`kitchenware-appliances`. Three of those are ordinary grocery, and the feature
exists to surface the categories a user does *not* consider Blinkit for.

The tie now breaks on **how many orders the persona has placed in the tile's
section**, which is a real signal from real history rather than an invented
weight. The persona's footprint:

| Section | Orders |
|---|---|
| Beauty & Personal Care | **0** |
| Household Essentials | 5 |
| Pet Store | 5 |
| Snacks & Drinks | 42 |
| Grocery & Kitchen | 97 |

An entire section — seven tiles — is untouched. That is the strongest
never-bought signal in the data, and it lines up with the idea doc, where beauty
and personal care is one of the two most-refused categories (11 of 32) and
therefore exactly the awareness gap the panel targets. The spec's
`bestsellerRank` rule is preserved as the second sort key; tile id is the third,
for determinism.

A cap of `MAX_TILES_PER_SECTION_OFFERED` (2) then stops all four offered tiles
collapsing into that one section. Without it the model would choose both slot-B
rows from Beauty and the panel would read as monolithic; with it, the offered set
is `baby-care`, `bath-body`, `electronics`, `home-lifestyle` — every one in a
section the persona has barely touched, but with a genuine choice available to
the model and to Browse & Replace.

**D24 — `buildRows()` takes an optional `chooseProduct` callback, so Phase 6 needs no restructuring.**
The deterministic path passes nothing and gets the top-ranked product plus a
template reason. The model path will pass a callback returning its pick and its
reason line per shortlist. Crucially, a pick the callback returns that is **not
in that shortlist is ignored** and the top-ranked product is used instead — so
a hallucinated product id degrades to the deterministic answer at the point of
assembly, before validation is even reached.

**D25 — A malformed request body yields an empty cart, never a 500.**
The route trusts nothing in the body: unparseable JSON, a missing or `null`
`cart`, non-string product ids, missing quantities, `null` array elements and
negative quantities all degrade to an empty or partially-filtered cart. An empty
cart is a legitimate state — the idea doc explicitly removed the
minimum-cart-size rule — so there is no input for which returning an error is
more correct than returning a panel. The client's `signature` is accepted only
as a label to match the response to a request; the panel itself is always
computed from the cart contents.

### Gotchas

- **Do not validate never-bought reason lines by banning the word "you".** The
  spec's own canonical never-bought line is *"Popular with households near you"* —
  a locality claim, not a history claim. The first draft of the test's detector
  used `/\byou\b/` and failed all three panels against the correct answer. What
  must be caught is a claim of **prior purchase** ("you ordered", "your usual",
  "again", "used to", "restock"). The corrected pattern lives in
  `phases/phase-4-recommend/verify_recommend.ts` as `CLAIMS_HISTORY`, is
  self-tested against 9 must-reject and 4 must-accept lines, and **Phase 6's
  validator should reuse that shape** rather than reinventing it. (EDGE_CASES E2)
- **The deterministic slot-B pick can be implausible at a low ceiling.** A ₹100
  ceiling currently surfaces "Peristaltic Nipple — 'S' Hole" from `baby-care`.
  Every rule holds — never-bought tile, under the ceiling, no false claim — but
  it is not a sensible suggestion for this persona. This is the exact gap the
  model layer fills (spec §4 Step 8: choose what "most plausibly belongs
  alongside" the cart). Not a Phase 4 bug; a Phase 6 success criterion.
- **`getProductsByTile` is pre-sorted by `bestsellerRank`** in `catalogue.ts`, so
  shortlists inherit bestseller order for free. Anything that re-sorts a
  shortlist downstream will silently break the fallback's "top-ranked product"
  guarantee.
- **Classification is memoised at module scope.** History never mutates at
  runtime, so this is safe — but it means a test that wants a different persona
  cannot simply edit `history.json` between calls in the same process.

---

## Phase 5 — Panel UI

**Completed.** Spec test passes live on all four clauses; panel cache suite
passes 11/11. Detail in [`phases/phase-5-panel-ui/README.md`](phases/phase-5-panel-ui/README.md).

Closed edge cases **C7** (cache cap), **F1** (no shift on resolve), **F2**
(animated row exit), **F3** (row restored in position), **F4** (double-tap
guard), **F7** (dismiss scope), **G1** (one impression per mount).

### The prototype

The owner supplied two screenshots of a prototype checkout and asked for the
panel to emulate it. **Adopted:** lavender-tinted panel with a violet accent, a
spark icon beside a "Smart Cart" heading over "Suggested for you", a dismiss
control top-right, per-row layout of image → name → control-over-price, the
panel's position between cart items and Bill details, and the surrounding chrome
(delivery-time card, address block, Bill details with a FREE delivery line).

Four things in it were overruled by the project's own documents. Two were
decided by the owner when asked; two are unambiguous corrections the docs
already mandate.

**D26 — The row control is ADD, not a `− 0 +` stepper.**
The prototype's stepper sits at zero by default. Idea doc §7 flags this by name
as a required fix: one control with two meanings, the destructive one as the
default state, so a user reducing 2 → 1 → 0 "falls off a cliff into deletion".
The stated resolution is an ADD button that becomes a stepper only after the
first tap, which is also what spec 5.2 lists. Panel rows therefore match the
cart's existing steppers.

**D27 — Every row carries a reason line.**
The prototype has none — rows show name, Browse & Replace, price. The idea doc
calls the reason line **P0 and "not decorative"**: H2 identifies mindspace as the
problem and the reason line is the only element in the design that builds it, so
"a product tile without a reason is inventory". It is the feature, so it ships.

**D28 — No bulk-add tick. Owner's decision.**
The prototype pairs a green ✓ with the red ✗. Idea doc §7 calls it "recommended
cut for v1" and §12 lists it as blocking open question #2; spec §8 lists it under
Deferred. Asked, and the owner chose to cut it: highest-regret action on the
screen, no undo, contradicts the panel's purpose, and makes per-slot attribution
meaningless. Header carries dismiss only.

**D29 — No struck-through `mrp`, no "Special Price" tag. Owner's decision.**
The prototype shows ₹238 with ₹280 struck through. Spec §8 defers this to P1
because shipping a discount treatment makes recommendation lift and discount lift
inseparable. Asked, and the owner chose plain prices. `mrp` stays in the data,
unrendered.

Dismissal collapses to the header with a chevron to re-expand, per idea doc §7
("The Smart Cart header remains, with an affordance to bring the suggestions
back"), rather than removing the section outright.

One departure of my own: **row separators are soft solid hairlines, not dashed.**
The idea doc's design note warns that dashed borders "carry heavy coupon and
promo connotation in Indian commerce UI, and an ad-styled block is the visual
language users have trained themselves to skip — a real risk when trust is the
dominant barrier", and recommends keeping the tinted background while removing
row borders. The panel's dashed *outer* border is retained as the prototype's
signature; the internal dashes are not.

> ⚠️ **The outer dashed border and the red ✗ are both gone — see D38.** The
> panel is now full-bleed inside the cart card with a single hairline on top,
> and the control is the word "Hide". The idea doc's warning above is the reason
> that change was an improvement rather than a loss.

### Decisions

**D30 — A StrictMode fetch guard and an in-flight cancellation flag cannot coexist.**
The panel hung on its skeleton forever in development. The sequence: effect runs
and starts the request → React's StrictMode cleanup sets `cancelled = true` →
the effect re-runs but returns early on the ref guard that exists to prevent a
second request (G1) → the original response resolves, sees `cancelled`, and is
discarded. Nothing ever restarts it.

The two mechanisms solve the same problem in incompatible ways. The ref guard is
the one worth keeping, because it also prevents the doubled `panel_impression`
and the doubled request against a rate-limited free tier. The cancellation flag
is gone; a state update after a genuine unmount is harmless in React 18+.

**D31 — `RecommendResponse.outcome` is an addition to the spec's Step 11 shape.**
`source` only distinguishes model from not-model, but `recommend_call.outcome`
(spec §3.6) needs to know *why* — and on screen a fallback panel and a model
panel are identical, so the client cannot infer it. The route now returns
`outcome` alongside the spec's fields.

`RecommendOutcome` also gains a sixth value beyond the spec's five:
**`fallback_nokey`**, meaning no model was attempted because no key is
configured. That is a distinct and highly actionable diagnosis, and the single
most likely reason a deploy that works locally serves fallback panels in
production — which is exactly what spec §6 Phase 9's test exists to catch.
Folding it into `fallback_error` would bury it behind genuine failures.

### Gotchas

- **A `max-height` equal to a row's content height silently clips it.** Tailwind
  sets `box-sizing: border-box`, so a 1px row border eats into the cap. This made
  the resolved panel measure 2px shorter than its own skeleton — a real F1
  violation, far too small to catch by eye. Fixed with
  `grid-template-rows: 1fr → 0fr`, which collapses to exactly zero and imposes no
  cap at rest, so no magic number has to be kept in sync with the row height.
- **Never put a side effect inside a `setState` updater function.** React
  deliberately double-invokes updaters under StrictMode to surface impure ones,
  so a `logEvent` in there fires twice per interaction. This was silently
  doubling `panel_dismiss`. Updaters must be pure functions of previous state;
  compute and log outside.
- **`requestAnimationFrame` never fires while the browser pane is hidden**, so
  rAF-based measurement hangs until the tool times out. Use `setTimeout`
  instead — timers still run. Screenshots were unavailable again this session
  for the same reason; layout was verified by measuring `getBoundingClientRect`
  in both states instead, which is stronger evidence than a screenshot anyway.
- **To observe the skeleton at all, patch `window.fetch`** to hold
  `/api/recommend` open, then navigate away and back *client-side* so the patch
  survives (a full reload discards it). Clear `sc_panel_cache` first or the
  remount hits the cache and never shows a skeleton.
- **The panel is deliberately absent on an empty cart.** The idea doc's "no
  minimum cart size" removed a two-item floor; it does not mean the panel should
  render over an empty basket.

---

## Phase 6 — Model layer

**Completed.** Spec test passes live against the Groq API on every clause;
verification suite passes 80/80. Detail in
[`phases/phase-6-model/README.md`](phases/phase-6-model/README.md).

Closed edge cases **E1** (key leak), **E2** (false history claim on never-bought),
**E3** (hallucinated ids), **E4** (duplicate tile / cross-slot picks), **E5**
(fenced JSON), **E6** (timeout / 429 / non-200), **E7** (model deprecation),
**E8** (line length), **E9** (prompt injection) — and added and closed **E10**,
plus added **E11** (token-per-minute limit) as accepted.

**Both remaining S1s are now closed. Every S1 in the register is closed.**

### What the model actually changed

On the snacks-and-staples cart this file named as the Phase 6 success criterion:

| | Deterministic | Model |
|---|---|---|
| Dormant 1 | Dish Wash, rank 1 | **Compostable Garbage Bags, rank 4** — the persona's own lapsed staple |
| Dormant 2 | Pet Food Variety Stix, rank 1 | Multigrain Biscuit, rank 3 |
| Never-bought 1 | **Peristaltic Nipple — 'S' Hole**, rank 1 | Baby Wipes, rank 3 |
| Never-bought 2 | Battery AA, rank 1 | Battery AA, rank 1 |

Three of four rows moved off rank 1, and the implausible suggestion this file
flagged is gone. **It did not happen with the first prompt** — see D33's gotcha.

### Decisions

**D32 — The model is GPT-OSS 120B, not the spec's Llama 3.3 70B. Owner's decision.**

`GROQ_MODEL` is `openai/gpt-oss-120b`. It is a larger open-weights model and
better at the two things this prompt actually needs: staying inside a supplied id
list, and not writing a history claim into a never-bought line. The pinning that
spec §7.5 asks for is what made this a one-line change, and E7 is now proven
rather than assumed.

Two consequences the spec did not anticipate, because Llama 3.3 is not a
reasoning model and this one is:

- **`MODEL_REASONING_EFFORT` is "low".** Reasoning tokens are generated before
  the first content token, so they are spent entirely inside the 4s abort and
  buy nothing visible. Measured at "low": ~330 reasoning tokens, 1.3–2.0s round
  trip. The task is a constrained pick from a supplied list, not a problem that
  rewards deliberation.
- **`MODEL_MAX_COMPLETION_TOKENS` is 1024, and it must cover the reasoning.**
  A 16-token cap during testing returned `finish_reason: "length"` with **empty
  content** and 14 reasoning tokens. A cap sized for the visible answer alone
  returns nothing at all.

**D33 — The model sees 6 products per shortlist; the response still carries 12.**

Spec Step 8 says to send the seven shortlists. Sent whole, they cost **4,729
prompt tokens** — measured, not estimated. The Groq free tier's binding limit is
**8,000 tokens per minute** (requests are 1,000/day and never bind), so the
second checkout visit inside a minute returned HTTP 429 and served a fallback
panel. That was reproduced within minutes of the first working call, and it is
exactly how the feature would fail in front of an evaluator clicking through two
carts.

`MODEL_SHORTLIST_DEPTH` (6) plus un-indented JSON takes the prompt to **2,072
tokens** — three calls a minute instead of one, and 1.5s instead of 2.0s. What
the model loses is ranks 7–12 of a list already sorted by bestseller rank: the
tail it was least likely to pick. **Browse & Replace still receives all 12**, so
the two numbers are not interchangeable.

**D34 is the next free number.**

### Gotchas

- **The first prompt produced the same panel as the deterministic path.** Every
  pick came back rank 1, including the implausible baby-care one. The lists are
  handed over in bestseller order and the model took the top of each. What fixed
  it was saying so explicitly — *"listed in order of overall popularity, NOT in
  order of how well they suit this cart; the first product in a list is
  frequently the wrong answer"* — plus a concrete negative example ("a cart of
  snacks and staples is no reason to suggest infant feeding equipment"). Without
  that paragraph the model layer is an expensive way to reproduce `products[0]`.
  If a future prompt edit makes picks collapse back to rank 1, that paragraph is
  the first thing to check.
- **The build spec's own example dormant line is unsafe.** §4 Step 8 shows
  `"You used to order this regularly"` as a valid model response. The product on
  a dormant row is chosen by bestseller rank and is usually not one the persona
  bought, so that sentence is false about the item on screen — E2's failure mode
  on the other slot. Now E10, enforced by requiring the tile label in slot-A
  lines. Do not "fix" that check by loosening it back to the spec's example.
- **A rejected reason and a rejected pick are different failures.** A bad id
  discards the entry and the slot is refilled. A bad *line* discards only the
  line — the model's judgement about which product suits the cart is the thing
  it was called for, and is unaffected by it having written a sentence we will
  not show. `buildRows` also drops a reason whose product was rejected, so a row
  can never wear a sentence written about a different product.
- **The `openai` SDK retries twice by default.** Both retries land inside the
  same 4s abort, so they cannot produce a usable answer, and on a 429 they spend
  two more requests against the limit that just rejected us. `maxRetries: 0`.
- **Next 16 refuses to run a second dev server in the same directory** and exits
  immediately — which looks exactly like the route crashing the server. Three
  servers "died" on their first request before the log showed
  `⨯ Another next dev server is already running`. If a server dies on request,
  read its log before suspecting the code. A production server
  (`next build && next start -p <port>`) has no such restriction and is also the
  only way to test with a different `GROQ_API_KEY` without touching `.env.local`.
- **`x-ratelimit-remaining-tokens` is the header that explains a fallback panel.**
  A 429 arrives in ~100ms, so a fast fallback is a rate limit and a slow one is a
  timeout — but the header says so directly.

---

## Phase 7 — Browse & Replace

**Completed.** Spec test passes live on all four clauses; verification suite
passes 71/71. Detail in
[`phases/phase-7-browse-replace/README.md`](phases/phase-7-browse-replace/README.md).

Closed edge cases **F5** (empty sheet) and **F6** (replacement already in cart).

### Decisions

**D34 — Browse & Replace is the third line of the middle column, under the reason line.**

The owner's prototype put "Browse and Replace" directly under the product name.
The prototype had **no reason line**, and the idea doc calls the reason line P0
and "not decorative" (D27) — so both wanted the same slot. The reason line takes
it, because it is the element that does the feature's actual work, and the
control moves down one line. Approved by the owner against a mockup.

Three alternatives were considered and rejected:

| Placement | Why not |
|---|---|
| Right column, under the price | The column is ~70px wide, so the label shrinks to "Replace", and a third control sitting 4px from ADD is a mis-tap generator. |
| Right-aligned on the reason line | Reason lines already truncate at 480px — the observed panel shows *"…5 weeks…"*. Giving that line a competitor makes every dormant reason unreadable. |
| Whole row tappable | Undiscoverable, and an accidental row-tap while reaching for ADD is the same interaction cliff the idea doc's stepper critique warns about. |

The cost is 16px per row — `PANEL_ROW_HEIGHT_CLASS` went from `h-[76px]` to
`h-[92px]`. Because the skeleton reads that same constant, F1 did not regress:
measured **421.33px in both states, 0px shift**. That constant existing is the
only reason this was a one-line change.

> ⚠️ **Both numbers moved again after Phase 8.** The row is now `h-[106px]` and
> the panel measures 477.33px, because the reason line wraps to two lines — see
> the interlude below. F1 still measures 0px shift. The figures above are the
> Phase 7 record, not the current state.

**D35 — `panel_replace_done.originalProductId` is the product that was on the row, not the panel's first.**

On a second replacement of the same row, the event names the product being
swapped *out*, not the one the panel originally computed. A replace event
describes one swap; naming the panel's first product would claim a swap that
never happened, and the full chain is still recoverable from the event sequence
in order. `panel_replace_open` records the displayed product for the same reason.

### Gotchas

- **A reason line does not automatically survive a swap.** Slot A keeps its
  line, because that line is structurally a claim about the *tile* — the
  template builds it from the tile label, and a model line is rejected unless it
  contains it (E10) — and the tile does not change. Slot B does not keep its
  line, because nothing guarantees a never-bought line is not about the specific
  product: *"handy for weekend baking"* is fine above a cake mix and false above
  batteries. This is the same rule `buildRows` applies when it discards a reason
  whose product was rejected — **a line never outlives the product it was
  written about.**
- **Panel rows are keyed by `position`, not `productId`.** A replacement is the
  same row holding a different product; keying by product unmounts and remounts
  the row, throwing away its place in the list.
- **F6 is not redundant with the shortlist's cart exclusion.** The panel is
  computed once at mount and cached, so by the time the sheet opens the cart can
  hold products the shortlist was built without. The sheet re-applies the
  exclusion against the *live* cart.
- **The sheet is where a rule leaks.** It is a second surface onto the same
  candidates, so the suite checks every alternative on every row of four carts
  against D1, D1a, D3, D4 and D5 — 32 checks — and then replaces all four rows
  at once, which is the worst case for tile diversity. Any future change to the
  sheet should keep that group green.

---

## Phase 8 — Events

**Completed.** Spec test passes live — a full flow produced 11 events covering
all nine types; verification suite passes 43/43. Detail in
[`phases/phase-8-events/README.md`](phases/phase-8-events/README.md).

Closed edge cases **G2** (SSR guard), **G3** (cap and its accepted cost),
**G4** (`latencyMs` defined).

This phase built almost nothing — `events.ts` shipped in Phase 2 (D17) and each
phase wired its own call sites. What it owed was the audit, **and the audit
found a defect on its first pass.**

### Decisions

**D36 — Cart mutations and their events live together, in `cartActions.ts`.**

D22's rule — `cart_add`/`cart_remove` fire only on the 0↔1 transition — was
implemented separately in `ProductCard`, `CartLine` and `SmartCartPanel`. **One
of them drifted.** The panel's row stepper, added in Phase 5 after D22 was
written, called `removeFromCart` directly and logged nothing, so a product could
leave the cart with no event marking it — in a log whose entire purpose is
attribution.

The path is narrow: a panel row only shows a stepper at quantity ≥ 1, which on
that surface means during the row's 220ms exit animation after ADD. It was still
reproduced live, and fixed.

Three call sites implementing one rule, one of them wrong, is a structural
problem rather than a typo — so the fix was to stop having three.
`cartActions.ts` (`addProduct`, `incrementProduct`, `decrementProduct`) is now
the only place the rule exists, no component mutates the cart directly, and the
rule is unit-tested against the module rather than through three components.

`incrementProduct` deliberately exists even though it only calls `addToCart`:
the absence of an event there is a decision, and it should be visible at the
place someone would otherwise add one.

### Gotchas

- **"No window" does not mean "empty log".** `storage.ts` writes every value to
  a **module-level** in-memory map as well as to localStorage — that map is what
  keeps a session coherent when storage is unavailable (C3) — and being
  module-level it survives a test's fake-window reset, still holding the
  previous block's events. The first G2 check asserted `readEvents().length === 0`
  and failed for exactly that reason. The property that matters is that the SSR
  guard makes `logEvent` a **no-op**; assert that the log is *unchanged*, not
  that it is empty. This applies to any future test of any `sc_*` key.
- **`recommend_call` is not logged on a cache hit.** The event describes a call,
  and a panel served from `sc_panel_cache` made none. Counting panel *views*
  means counting `panel_impression`, which fires on every mount.
- **`panel_impression` reports the rows as first shown**, from
  `state.response.rows` rather than the Browse & Replace overlay. An impression
  is what the panel offered; `panel_replace_done` is what the user did about it.
  Do not "fix" it to report replaced rows.
- **A demo session produces ~10 events** against a cap of 500, measured on the
  spec's own full flow. That is the number that makes G3 acceptable — if the
  event set ever grows an order of magnitude, revisit the cap rather than the
  conclusion.

---

## Interlude — three UI changes taken after Phase 8

Owner-requested changes taken after Phase 8, before deploy, all from looking at
the app on a real screen. None is in the build spec.

**D37 — Nine home-screen tiles open a category listing. The spec defers browse navigation entirely.**

Spec §6 Phase 2 and the D12 consequences both state that no tile is clickable in
v1. The owner asked for two tiles per section to become browsable, and the
reasoning is the same one that produced D12: an evaluator who taps a category
and gets nothing concludes the grid is decoration. Blocking browse simulated the
symptom; opening it and watching the panel still do its work demonstrates the
mechanism.

The nine are listed in `BROWSABLE_TILES` in `config.ts` — one line to change —
and deliberately span all three classifications, so browsing demonstrates the
persona and not just the catalogue:

| Class | Tiles |
|---|---|
| Active | `vegetables-fruits`, `atta-rice-dal`, `chips-namkeen`, `drinks-juices` |
| Dormant | `cleaners-repellents`, `pet-store` |
| Never-bought | `bath-body`, `skin-face`, `electronics` |

Pet Store contributes one, because that section contains exactly one tile.

`/category/[tile]` is a **server component with `generateStaticParams`**, so all
nine prerender to static HTML and cost nothing at request time — the same
posture as `/` and `/search`. A tile not in the list 404s rather than rendering,
because a page the home screen does not link to is not a page this app has.

Two consequences worth knowing:

- **`cart_add.source` gains a third value, `"category"`.** Spec §3.6 offers
  `search | panel`, but it predates browsable categories. Attributing a browse
  as a search would inflate search's conversions, which is exactly the error D22
  exists to prevent, so the honest option is a third value. `ProductCard` takes
  a `source` prop, defaulting to `"search"`.
- **The grid now has mixed affordance** — 9 tiles respond, 18 do not. Rather
  than leave that to be discovered by tapping, a browsable tile gets a white
  card, a hairline border, a bolder label and a chevron; the rest stay flat on
  the sunken background. Nothing is dimmed, because an inert tile here is
  scenery rather than a disabled control. **If all 27 should be browsable, it is
  a one-line change to `BROWSABLE_TILES`** — the route and the grid already
  handle any tile.

**D38 — The panel is part of the cart card, and the dismiss control is the word "Hide".**

Both owner-requested, after seeing it on a real screen. They supersede two
Phase 5 choices.

*One block.* The panel carried `mx-3 my-2`, its own rounded corners and the
prototype's dashed violet border, so it read as a separate card floating **over**
the cart rather than continuing it. That works against the panel's own argument,
which is that these are things to consider alongside what is already in the
basket. It is now full-bleed inside the cart card — no horizontal inset, no
outer border, only the bottom corners rounded because it is the card's last
child, and a single hairline on top doing the separation the dashed border was
doing. Measured: same width and left edge as the card, **0px gap above and
below**. The tint stays, so rows still read as provisional rather than bought.

Losing the dashed border is a gain, not a compromise: the idea doc's design note
warns dashed borders "carry heavy coupon and promo connotation in Indian
commerce UI, and an ad-styled block is the visual language users have trained
themselves to skip — a real risk when trust is the dominant barrier".

*"Hide", not a red ✗.* A red circular cross is the visual language of **delete**,
sitting one row above four ADD buttons on a panel whose job is to earn a little
trust. What the control does is collapse the section, and a word says so where
an icon could only imply it. It toggles to "Show". The header stays behind it,
per idea doc §7 — this minimises rather than destroys. Measured: 477px → 51px
and back, with exactly **one** `panel_dismiss` logged across both taps, since
re-expanding is not a dismissal.

**The panel reason line wraps to two lines.**

Observed on a real screen: *"You last ordered from Cleaners & Repellents 5
weeks…"* — clamped to one line, the longer tile labels cut the sentence off and
lose the word the claim depends on. The reason line is the one element the idea
doc calls P0, so it now gets `clamp-2` and the row height absorbs it:
`PANEL_ROW_HEIGHT_CLASS` went `h-[92px]` → `h-[106px]`. The skeleton reads the
same constant and gained a fourth shimmer bar, so **F1 still measures 0px shift**
(477.33px in both states). This predated Phase 7 — it was not caused by the
Browse & Replace line.

---

## Phase 9 — Deploy

**Completed and live at <https://smart-cart-mvp-blinkit.vercel.app>.** The
spec's test passes: `recommend_call { outcome: "model", latencyMs: 1482 }`.
Detail in [`phases/phase-9-deploy/README.md`](phases/phase-9-deploy/README.md).

Closed edge cases **H2** (bundle size — the function deployed and served),
**H3** (model, not fallback, in production), **H4** (`.env.local` absent from
the pushed tree).

No code and no verify suite: 9.1–9.3 is entirely infrastructure. Pre-flight
re-confirmed `tsc`/`eslint`/`build` clean, 366/366 across the nine suites,
`git log --all -- .env.local` empty, and no `gsk_`/`GROQ_API_KEY` anywhere in
`.next/static/` (E1 re-checked).

**Production evidence:** all routes 200; the panel renders four rows with
reason lines; invariants 1–6 hold on the served response (4 distinct tiles,
A,A,B,B, slot B under the ₹100 ceiling, nothing from the cart's tile); model
picks came back rank 1, 6, 17, 28, so D33's anti-rank-1 prompt paragraph is
still doing its job; and three consecutive carts inside one minute all
returned `model`, so E11's mitigation holds under demo-shaped usage.

### D39 — Development moved from `master` to `main`.

The repo was created on GitHub with a README, which made `main` the default
branch while the whole build sat on `master`. Rather than repoint Vercel at
`master`, the README commit was merged into this history
(`--allow-unrelated-histories`) so `git push origin master:main` was a
fast-forward, and local `master` was renamed `main`. **`origin/master` still
exists at `73ec818` and is now stale** — every commit in it is contained in
`main`, so deleting it loses nothing, but nothing has deleted it yet.

### Two 404s that were not the app

Both cost real time and neither was a code defect. **Full writeups, including
the exact symptoms, are in the phase README** — this is the short version,
because the second one in particular will catch anyone who imports a Vercel
project before the code is on the default branch.

1. **Vercel builds the *default* branch.** It cloned `main` (one README),
   found no `package.json`, and produced nothing: `Build Completed in
   /vercel/output [13ms]`. **A 13ms "successful" build with no route table has
   not built this app.**
2. **Framework Preset is decided at import time and then stored.** Because
   `main` was README-only at import, detection set the preset to **"Other"**,
   and fixing the branch did not revisit it — so the next build compiled for
   33s, reported Ready, then published `public/` as a flat static site.
   Diagnosable without the dashboard: every route 404s while
   `/images/p_00001.png` returns 200. **A static asset serving while every
   route 404s means the preset is wrong, not the code.** Fixed in Settings →
   Build and Deployment → Framework Preset → `Next.js`.

**Do not put the catalogue images through `next/image`** (H1) — Vercel meters
optimised source images and 2,236 of them would exhaust the free tier
mid-demo. `catalogue.json` (0.62 MB) remains the only large static import in
the route; do not add more.

---

## Open edge cases (2)

From [`EDGE_CASES.md`](EDGE_CASES.md). Everything else is closed or withdrawn —
**57 closed, 1 withdrawn, 2 open** of 60.

| Phase | Open |
|---|---|
| 4, 7 | D7 thin shortlists at a low ceiling |
| 6, 9 | E11 token-per-minute rate limit — accepted, mitigated, not eliminated |

**No S1 is open, and neither remaining item is a defect.** E11 is the nearest
thing to a live risk — the Groq free tier's 8,000 tokens/minute is why a demo
*could* show a model panel on one cart and `fallback_ratelimit` on the next
within the same minute. D33 (shortlist depth 6, ~2,072 prompt tokens) buys
roughly three calls a minute, and three consecutive production calls were
measured all returning `model`. It is mitigated, not eliminated.

---

## Tooling notes (browser pane, dev server)

Consolidated because they cost real time across several phases and none is
obvious.

- **Next 16 will not run two dev servers in the same directory.** The second
  exits immediately with `⨯ Another next dev server is already running`, which
  from the outside is indistinguishable from the route crashing the server —
  every request returns HTTP 000 and `preview_list` comes back empty. If another
  session already holds one, either use it, or build and run a production server
  on another port (`npm run build && npx next start -p 3211`), which has no such
  restriction and additionally lets you vary `GROQ_API_KEY` per launch without
  editing `.env.local`.
- **CSS animations are frozen in the pane, exactly like `requestAnimationFrame`.**
  `document.timeline.currentTime` reads 0, so an element sits at its first
  keyframe forever — the Browse & Replace sheet appeared to render entirely
  below the fold. To measure resting geometry, finish the animations first:
  `el.getAnimations().forEach(a => a.finish())`.
- **`javascript_tool` shares one scope across calls**, so a second call
  declaring `const rows` fails with "already been declared". Wrap each snippet
  in an IIFE.
- **A browser-pane error can contradict a clean build.** A long-lived preview tab
  kept reporting a stale import error after a constant was renamed — surviving
  `preview_stop`, deleting `.next`, and a fresh `preview_start`. The disk, `tsc`
  and `next build` were all clean; the stale module graph lived in *the tab*. A
  new tab (`tabs_create`) loaded correctly first time. **If the error contradicts
  the build, open a fresh tab before debugging.**
- **Screenshots were unavailable in every session so far** — the pane is not
  displayed, so nothing composites and `computer{action:"screenshot"}` times out.
  Layout was verified by measuring `getBoundingClientRect` instead, which caught a
  2px shift no screenshot would have shown. **The UI has never been reviewed by
  eye. Do a visual pass before deploy.**
- **`requestAnimationFrame` never fires while the pane is hidden**, so rAF-based
  measurement hangs until the tool times out. Use `setTimeout`.
- **Prefer `element.click()` via `javascript_tool` over coordinate clicks.**
  Coordinate clicks on `ref_N` intermittently missed after a viewport resize, with
  no error — the handler was fine.
- **`read_page`'s `interactive` filter can report "(empty page)"** on a
  results-heavy page that is actually rendering. Cross-check with `get_page_text`
  or `filter: "all"`.
- **React state updates are not visible in the same synchronous read** as the
  `.click()` that caused them. Re-read in a separate call.
- **To observe the panel skeleton**, patch `window.fetch` to hold
  `/api/recommend` open, clear `sc_panel_cache`, then navigate away and back
  *client-side* so the patch survives — a full reload discards it.

---
