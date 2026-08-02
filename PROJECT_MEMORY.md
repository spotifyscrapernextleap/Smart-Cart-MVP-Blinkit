# Smart Cart — Project Memory

Single point of resource for handoff. Every phase appends its decisions, outcomes
and gotchas here. If this project changes hands, this file plus `phases/*/README.md`
should be enough to continue without the original build conversation.

**Governing documents:** [`smart-cart-build-spec.md`](smart-cart-build-spec.md) is
the literal build instruction — file paths, constant names and phase order come
from it. [`smart-cart-mvp-idea-doc.md`](smart-cart-mvp-idea-doc.md) is the product
rationale behind the rules.

**Companion register:** [`EDGE_CASES.md`](EDGE_CASES.md) lists all 47 identified
failure modes with severity, mitigation and owning phase. Each phase README states
which entries it closed.

**Conventions**
- App lives at the repo root (not nested in `smart-cart/`), so `phases/`, `data/`,
  `scripts/`, `src/` and `public/` are siblings.
- Decisions are numbered `D<n>` and referenced from phase READMEs.
- A decision is logged when it departs from the spec, resolves an ambiguity in it,
  or would otherwise be invisible to whoever reads the code next.

---

## Environment as built

| | |
|---|---|
| Node | v24.15.0, npm 11.16.0 |
| Next.js | 16.2.12 (App Router, Turbopack) |
| React | 19.2.4 |
| Tailwind | v4 (via `@tailwindcss/postcss`) |
| TypeScript | 5 |
| Python | **3.9.9** — spec asks for 3.10+ |
| Python packages | pandas 2.3.3, Pillow 10.2.0, openpyxl 3.1.5 |
| Git | initialised at repo root, no remote yet |
| Groq key | not yet obtained — first needed in Phase 6 |

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

**D5 — `Oral Care` files under `health-pharma`, which makes the spec's `colgat` test unsatisfiable. NEEDS A CALL BEFORE PHASE 2.**
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

**D10 — `config.ts` is byte-for-byte the spec's §7.4, and stays that way for now.**
Several edge-case mitigations want new tunables — a minimum query length (B5), a
panel-cache cap (C7), a quantity clamp (C5). None belong to Phase 1, so none were
added. When they arrive they go **into `config.ts`** under a clearly marked section,
never inline, because the file's stated contract is that it holds every tunable.

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
