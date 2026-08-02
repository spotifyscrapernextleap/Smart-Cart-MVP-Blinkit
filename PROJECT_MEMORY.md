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
