# Smart Cart — Edge Case Register

Every failure mode identified across the build, with the mitigation and the phase
that owns it. Written after Phase 0, from the build spec plus what the real data
turned out to look like.

**How to use this.** Each phase README must state which of these it closed. An
entry is not closed because code exists that *should* handle it — it is closed
when something was run that would have failed before the fix.

**Severity**

| | Meaning |
|---|---|
| **S1** | Breaks the demo, or breaks the feature's core claim. Cannot ship. |
| **S2** | Visible defect an evaluator would notice. Fix before deploy. |
| **S3** | Cosmetic, or only reachable by deliberate abuse. Fix if cheap. |

**Status:** ✅ = closed and verified by a phase test · `open` · `mitigated` (handled in code) · `accepted` (known, deliberately not fixed) · `needs-decision` (blocked on a product call)

⚠️ marks a case the build spec does not cover. Those are the ones most likely to
be missed, because there is no instruction to follow.

---

## A. Data layer

| # | Sev | Case | Mitigation | Phase |
|---|---|---|---|---|
| A1 | S1 | **Product ids are positional.** Rebuilding the catalogue reshuffles `p_00001`..`p_02236`, silently invalidating all 2,236 images and every id in `history.json`. Already hit twice in Phase 0. | Fixed rebuild order documented in PROJECT_MEMORY: `reduce_catalogue.py` → delete `public/images/` → `generate_images.py` → `author_history.py` → `verify_history.js`. `verify_history.js` fails loudly on unknown ids. | 0 ✅ |
| A2 | ✅ S2 | A product's PNG is missing → broken image icon in search, cart and panel. | `onError` handler on every product image swapping to a neutral tile-coloured placeholder. Never render a raw broken `<img>`. | 2 |
| A3 | ✅ S2 | ⚠️ **Duplicate product names across brands.** Dedup was on `(product, brand)`, so "Almonds" can exist three times under three brands. In the cart and the panel these read as identical rows. | Always render brand alongside name in cart lines and panel rows. Keys are ids, never names. | 3, 5 |
| A4 | ✅ S2 | **122-character product names.** Longest in the catalogue. Overflows row layouts, wraps cart lines to four lines, pushes prices off-screen at 480px. | Two-line clamp with ellipsis on panel rows and cart lines; full name only on the search card. Test with `p_01774`-class names specifically. | 2, 3, 5 |
| A5 | S3 | Non-ASCII in names (`é`, `₹`, `&`) breaking JSON, image text or Fuse matching. | Files written UTF-8 and read UTF-8; Pillow falls back per-glyph. Verified in Phase 0 — no mojibake in generated tiles. | 0 ✅ |
| A6 | S3 | `history.json` edited so an order is older than `accountAgeDays`, making the persona incoherent. | `verify_history.js` asserts the span; re-run after any edit. | 0 ✅ |

---

## B. Search

| # | Sev | Case | Mitigation | Phase |
|---|---|---|---|---|
| B1 | ~~S1~~ | ~~**Non-searchable products leaking into results.**~~ **Withdrawn — decision D12 makes all 2,236 products searchable and addable, so there is nothing left to leak.** The concern has not vanished, it has moved: the panel must now earn its recommendations against a catalogue the user *could* have reached by searching. See D11 below. | n/a | — |
| B1a | ✅ **S1** | ⚠️ **Zero results now reads as a broken app, not as a design.** With everything searchable, a query returning nothing means we genuinely do not stock it — and an evaluator will try `iphone`, `cigarettes`, `condoms`, `paan`. The old empty state said "correct behaviour"; now it must say "not available". | Explicit **"Not available here"** empty state naming the query, visually distinct from a loading or error state. This is the surface an evaluator hits first when probing coverage, so it has to look deliberate. | 2 |
| B2 | ✅ S2 | ⚠️ **Alias rewriting inside longer words.** A naive `String.replace` turns `dalchini` into `dal pulses lentilchini`, and `andaman` into `eggman`. My alias map contains short keys (`dal`, `tel`, `anda`) that are substrings of real words. | Rewrite on **whole tokens only**, and match multi-word keys (`cold drink`, `kapde dhone`) as phrases before single tokens. Longest key first. Unit-test `dalchini`, `andaman`, `atta noodles`. | 2 |
| B3 | ✅ S2 | Empty or whitespace-only query, or `/search` with no `?q=`. | Render a prompt state, not an empty grid. Never call Fuse with `""`. | 2 |
| B4 | ✅ S2 | ⚠️ **Catalogue coverage is now on display.** Everything is searchable, so search is a direct test of what we stock. `shampoo` and `phenyl` return nothing today even though `hair` (70 products) and `cleaners-repellents` (100) clearly contain the concept — the source names them differently. | Aliases carry this: every gap found while testing becomes an entry in `search-aliases.json`. Budget time in Phase 2 to search the obvious terms per tile and close the misses. | 2 |
| B5 | ✅ S3 | One- or two-character queries return noise at threshold 0.4 across all 2,236 items. | Require ≥2 characters before querying; below that show the prompt state. | 2 |
| B6 | ✅ S3 | Very long or URL-encoded `?q=` value. | React escapes by default. Never use `dangerouslySetInnerHTML`. Clamp displayed query length. | 2 |
| B7 | ✅ S3 | Result cap of 40 hides product 41+. | Accepted — spec'd. Show the count so the cap is legible. | 2 |

---

## C. Cart and storage

| # | Sev | Case | Mitigation | Phase |
|---|---|---|---|---|
| C1 | ✅ **S1** | **Hydration mismatch.** Reading `localStorage` during render makes the server produce an empty cart and the client a full one. React throws a hydration error and the page can blank. | All storage reads happen in `useEffect`, never during render. First paint is always the empty/skeleton state. | 1 |
| C2 | ✅ **S1** | ⚠️ **Cart holds a productId that no longer exists** — stale `localStorage` from before a catalogue rebuild, which given A1 is near-certain during development. `getProduct(id)` returns `undefined` and the cart page crashes on `.price`. | `readCart()` filters out ids absent from the catalogue and rewrites storage. Never trust persisted ids. Same guard on the panel cache. | 3 |
| C3 | ✅ S2 | `localStorage` unavailable — Safari private mode, disabled cookies, quota exceeded. | `storage.ts` wraps every access in try/catch and degrades to in-memory. The app must run, losing only persistence. | 1 |
| C4 | ✅ S2 | Corrupt JSON in any `sc_*` key. | Typed wrapper catches parse errors, clears that key, returns the default. | 1 |
| C5 | ✅ S2 | Negative, zero, fractional or absurd quantities via direct storage editing. | Clamp to integer 1..99 on read and write. Quantity 0 removes the line. | 3 |
| C6 | ✅ S3 | `?reset=1` clearing keys but leaving the param in history, so a back-navigation re-clears. | `history.replaceState` to strip the param after clearing. | 1 |
| C7 | ✅ S3 | Panel cache grows unbounded — one entry per distinct cart signature. | Cap `sc_panel_cache` at the most recent ~20 signatures. | 5 |

---

## D. Recommendation engine

The load-bearing section. Every rule here is one the spec says must be enforced by
code rather than by the model.

| # | Sev | Case | Mitigation | Phase |
|---|---|---|---|---|
| D1 | ✅ **S1** | ⚠️ **Products already in the cart can be recommended.** The spec never excludes cart contents from shortlists. If the persona's cart holds dog food and `pet-store` is dormant, the panel can recommend the exact product sitting above it. Every slot in this panel is supposed to point *away* from the current basket — the idea doc's non-goal #3, violated by omission. | Exclude all cart productIds from every shortlist, before the price ceiling. | 4 |
| D1a | ✅ **S1** | ⚠️ **A whole tile the user just shopped is still offered as a "discovery".** Now that every category is searchable, an evaluator will search `pedigree`, add dog food, and open the cart. Recommending *more* Pet Store as a dormant reactivation is nonsense: the category was reactivated thirty seconds ago. This is the failure mode that makes the panel look like it is not reading the cart at all. | **Exclude every tile represented in the cart from candidate selection**, both dormant and never-bought, then take the next-ranked tile of that type. Adding dog food should push the panel to `bakery-biscuits` / `tea-coffee-milk-drinks`. Test explicitly by carting from a dormant tile. | 4 |
| D2 | ✅ **S1** | ⚠️ **Fewer than 2 tiles of a slot type survive filtering.** Spec says "proceed with what exists and let the fallback fill remaining positions" but never says *what* fills an unfillable A slot. Left undefined, the panel renders 3 rows and the 2+2 guarantee silently breaks. **D1a makes this materially more likely** — with only 4 dormant tiles, carting from two of them leaves two, and from three leaves one. | **Approved rule: the panel always renders 4 rows.** If slot type A cannot supply 2, backfill from type B and vice versa. The `slot` field on the row and on every event reports what the row **actually is**, never what position it occupies — otherwise slot-level metrics, the feature's whole defence, become fiction. | 4 |
| D3 | ✅ **S1** | Durable the persona owns appears as a dormant candidate. | Exclude where `ownedProductIds.has(id) && !isConsumable`, before ranking. Observable case is `p_02159` Padded Harness, rank 3 in `pet-store`. | 4 |
| D4 | ✅ **S1** | Never-bought product priced above the ceiling reaches the model. | Filter at shortlist construction, never in the prompt. The model is then structurally incapable of violating it. | 4 |
| D5 | ✅ **S1** | Two rows from the same tile — the diversity constraint. | Shortlists are built one per tile and each tile can contribute one row; enforced by construction, then re-asserted in validation. | 4, 6 |
| D6 | ✅ **S2** | ⚠️ **Never-bought tile selection is still degenerate.** Decision D13 assigns 3 random bestsellers per tile, which varies *which product* a tile leads with — but every tile still has a rank-1 product, so ordering **tiles** by their top product's rank still ties 17 ways and collapses to array order. | Still needs a tie-break in Phase 4, and one is no longer optional: array order offers oil, dry fruits, meat and kitchenware, none of which the feature exists to surface. Proposal to confirm at Phase 4: order never-bought tiles by **section distance from the cart's own sections**, which also satisfies the "match the cart intent" requirement in D12. | 4 |
| D7 | S2 | **Thin shortlists at a small cart.** At the ₹100 floor, `bath-body` has 4 products, `beauty-cosmetics` 5, `chicken-meat-fish` 5, `hair` 7, `skin-face` 7 — well under `SHORTLIST_SIZE` 12. Browse & Replace then opens with 3 alternatives. | Verified no tile is *empty* at ₹100, so the panel always fills. Accept short sheets; if a shortlist has <4 entries, prefer the next tile. | 4, 7 |
| D8 | ✅ S2 | Empty cart on `/cart` — reachable by direct URL. Subtotal 0, signature `""`, ceiling falls to the ₹100 floor. | Spec mandates no minimum cart size, so the panel still renders. Confirm the empty-cart page has a sane layout and the signature is a defined constant, not `undefined`. | 4, 5 |
| D9 | ✅ S3 | Entire top-12 of a dormant tile are owned durables, shrinking the shortlist to nothing. | Covered by the drop-tile-and-take-the-next rule. Not reachable with the current persona. | 4 |

---

## E. Model layer

| # | Sev | Case | Mitigation | Phase |
|---|---|---|---|---|
| E1 | ✅ **S1** | **`GROQ_API_KEY` leaking to the client.** Referenced in a client component, or prefixed `NEXT_PUBLIC_`, and the key ships in the browser bundle. | Read **only** in `src/app/api/recommend/route.ts`. Verified after a production build: `grep -rl "gsk_" .next/static/` and the same for `GROQ_API_KEY` both return nothing, and the only source occurrence is `route.ts:91`. Re-check before deploy. | 6 ✅, 9 |
| E2 | ✅ **S1** | ⚠️ **A never-bought reason line claiming user history** — "you ordered this before" about a category the user has never bought from. This is a direct lie to the user, on the slot type whose entire job is earning trust. The spec states the rule in the prompt but validates only length. | `CLAIMS_HISTORY` in `validate.ts` — the self-tested shape from Phase 4, **not** a ban on "you", which would reject the spec's own correct line. A hit discards the **line** and substitutes the template; the product survives, because the lie was in the sentence and not in the choice. | 6 |
| E3 | ✅ S2 | Model returns hallucinated productIds not in any shortlist. | Per-entry validation against the shortlist it claims to come from; failures replaced from the next unused shortlist of the same type with a template reason. The rejected line is discarded with its pick — a reason written about a product no longer shown is its own defect. | 6 |
| E4 | ✅ S2 | Model returns 2 picks from the same tile, or the same productId in both arrays. | A tile already used rejects the later pick. A dormant id offered as a never-bought pick is rejected too, since the search is scoped to that slot's own shortlists. | 6 |
| E5 | ✅ S2 | JSON wrapped in markdown fences despite JSON mode — a common open-weights failure. | `extractJson` strips ``` fences, leading prose and inline `<think>` blocks, then locates the outer braces rather than assuming them. Parse failure routes to fallback. | 6 |
| E6 | ✅ S2 | Timeout, HTTP 429, non-200, or network error. | 4s `AbortController`, try/catch, fallback path. `outcome` distinguishes `fallback_timeout` / `fallback_ratelimit` / `fallback_invalid` / `fallback_error`. Three of the four observed live; 429 arrived unprompted on the first day of use (see E11). | 6 |
| E7 | ✅ S2 | Model deprecated by Groq; the catalogue rotates. | `GROQ_MODEL` pinned in `config.ts` — already exercised once, by the switch to GPT-OSS 120B (D32), which was a one-line change. A 404 maps to `fallback_error`, not an unhandled throw. | 6 |
| E8 | ✅ S3 | Reason line over 100 chars, or with an exclamation mark. | Length rejected against `REASON_MAX_CHARS`; exclamation marks stripped rather than rejected, since one "!" is not worth discarding a good line. Tone rules beyond that are not machine-checkable — accepted. | 6 |
| E9 | ✅ S3 | Prompt injection via a product name in the catalogue. | The whole payload is `JSON.stringify`d, so a name arrives as a string value and never as a line of the prompt. Catalogue is ours and committed. Low risk, noted. | 6 |
| **E10** | ✅ **S1** | ⚠️ **A dormant reason line claiming the user bought THIS product.** E2's failure mode on the other slot, and **the build spec's own example response contains it** — §4 Step 8 shows `"You used to order this regularly"` as a valid dormant line. The product on a dormant row is chosen by bestseller rank and is usually *not* one the persona ever bought, so that sentence is false about the item on screen. The tile-level claim is the only true one available. | A slot-A line must contain its `tileLabel`, or it is discarded for the template. A positive test, not a blacklist: a line that names the category cannot be read as a claim about the item. | 6 |
| **E11** | S2 | ⚠️ **The free tier's binding limit is tokens per minute, not requests.** Measured on the live account: 1,000 requests/day but only **8,000 tokens/minute**. The original prompt cost 4,729 prompt tokens, so the *second* cart visit within a minute returned 429 and served a fallback panel — reproduced within minutes of the first working call. | Prompt trimmed to `MODEL_SHORTLIST_DEPTH` (6) and un-indented: 2,072 tokens, three calls a minute. `sc_panel_cache` already prevents a repeat visit to the same cart from calling at all. Residual risk accepted for a demo; `fallback_ratelimit` names it when it happens. | 6, 9 |

---

## F. Panel UI and interactions

| # | Sev | Case | Mitigation | Phase |
|---|---|---|---|---|
| F1 | ✅ **S1** | Layout shift when the skeleton resolves, moving Bill details under the user's thumb mid-tap. | Four-row fixed-height skeleton, identical height to the resolved panel. Measure both. | 5 |
| F2 | ✅ S2 | ⚠️ **Height still changes on ADD.** Spec forbids shift on *resolve* and separately mandates no backfill — so removing a row necessarily shrinks the panel. The two rules together still let the bill jump. | Animate the row out over ~200ms rather than removing it instantly, so the shift is legible as a consequence of the user's own tap rather than a glitch. | 5 |
| F3 | ✅ S2 | Removing a panel-added product from the cart must restore its row **in its original position with its original slot**. | Keep the full resolved row list in state; render it minus ids currently in the cart, rather than mutating the list on add. Restoration then falls out for free. | 5 |
| F4 | ✅ S2 | Rapid double-tap on ADD double-adds. | Disable the control while the add is in flight; cart writes keyed by productId are idempotent. | 5 |
| F5 | ✅ S2 | Browse & Replace sheet opens with 0 or 1 alternatives (see D7). | `canBrowse` returns false when the shortlist minus the displayed product minus cart contents is empty, and the row renders an inert "No alternatives left" in place of the control — same height, so nothing shifts. One remaining alternative still opens the sheet; that is a real choice, not an empty one. | 7 |
| F6 | ✅ S2 | Replacement product is already in the cart. | `alternativesFor` excludes cart contents. **Not redundant with the shortlist's own exclusion:** the panel is computed once at mount and cached, so by the time the sheet opens the cart can hold products the shortlist was built without. Verified live and in 32 suite checks across four carts. | 7 |
| F7 | ✅ S3 | Dismiss, then navigate away and back — does the panel return? | Define as **session-scoped**: dismissal persists for the visit, matching the spec's "remainder of the visit". | 5 |
| F8 | ✅ S3 | Sticky `ViewCartBar` overlapping the iOS home indicator. | `env(safe-area-inset-bottom)` padding. Test on a real phone, not just devtools. | 3 |

---

## G. Events

| # | Sev | Case | Mitigation | Phase |
|---|---|---|---|---|
| G1 | ✅ S2 | ⚠️ **React 18 StrictMode double-mounts effects in dev**, firing `panel_impression` and the recommend call twice. Inflates every metric and doubles Groq usage against a rate-limited free tier. | Guard the mount-time fetch with a ref keyed by cart signature. Verify exactly one `recommend_call` per cart in the events log. | 5, 8 |
| G2 | ✅ S2 | `logEvent` called during SSR. | Same `typeof window` guard as all storage. Tested as a **no-op** — the log is unchanged by a call with no window — not as "the log reads empty", which is a different and false claim: storage.ts keeps a module-level in-memory copy (C3) that outlives any single window. | 8 |
| G3 | ✅ S2 | Event cap of 500 drops the oldest — including the `panel_impression` that a later `panel_add` refers to, breaking attribution. | **Accepted**, and now measured rather than assumed: the spec's own full flow produces **10 events**, so eviction needs ~50× a realistic session. Cap holds at 500, drops oldest-first, trims on write and never mid-read. The orphaned add still carries its own `slot`, so slot-level attribution survives the loss of its impression. | 8 |
| G4 | ✅ S3 | `recommend_call.latencyMs` measured client-side includes network; measured server-side does not. | Defined as the **client-side round trip**, measured across the fetch in `SmartCartPanel` — that is the wait the user experiences, and a server-side figure would exclude exactly the part most likely to vary in production. Stated in the Phase 8 README. | 8 |

---

## H. Build and deploy

| # | Sev | Case | Mitigation | Phase |
|---|---|---|---|---|
| H1 | ✅ **S1** | ⚠️ **`next/image` optimisation across 2,236 PNGs.** Vercel's free tier meters optimised source images; an evaluator browsing the catalogue could exhaust the quota and start serving errors mid-demo. 18.8 MB across 2,236 files. | Serve these as plain `<img>`, or set `unoptimized`. They are already flat 400×400 tiles — there is nothing for the optimiser to win. | 2, 9 |
| H2 | S2 | Serverless function bundle size from static imports. `catalogue.json` is 0.62 MB, well under the 50 MB limit — but only because it is the *only* large static import in the route. | Confirmed safe. Do not import images or add further large static data into the route. | 4, 9 |
| H3 | S2 | Works locally with `source: "model"`, falls back in production — wrong region, missing Vercel env var, or a latency budget that only fits on a local network. | This is exactly what the spec's Phase 9 test exists to catch. Check `recommend_call.outcome` on the deployed URL, not just that the panel renders. Stays open until the owner deploys and checks it — see [`phases/phase-9-deploy/README.md`](phases/phase-9-deploy/README.md). | 9 |
| H4 | S2 | `.env.local` committed. | Gitignored and verified in Phase 0, re-checked in Phase 9 (`git log --all -- .env.local` empty, no key in `.next/static/`). Stays open as a checklist item — re-run the same check once more immediately before the actual `git push`, since commits can land after this was last verified. | 9 |
| H5 | S3 | 18.8 MB of PNGs in git. | Acceptable — well under any limit, and committing them is what makes the deploy reproducible. | 9 ✅ |
| H6 | S3 | Python 3.9 vs the spec's 3.10+. | Scripts avoid `match` and `X \| Y` runtime unions. Only affects the two local data tools, which never deploy. | 0 ✅ |

---

## Open decisions

All three original items are now resolved. One new one is open.

| # | Decision | Status |
|---|---|---|
| **D5** | `Oral Care` sits in non-searchable `health-pharma`, so the spec's `colgat` test cannot pass. | **Resolved by D12.** Everything is searchable, so `colgat` returns real results. The question no longer exists. |
| **D2** | What fills a slot when fewer than 2 tiles of a type survive. | **Approved.** Backfill across types, always 4 rows, report the row's true slot in events. |
| **D6** | Never-bought tile ranking is degenerate. | **Partly resolved by D13** (3 random bestsellers per tile). The tile-ordering tie remains; the tie-break is a Phase 4 call. Proposal: section distance from the cart. |
| **NEW** | Should `isSearchable` stay in the data model now that it is `true` for all 2,236 products? | Keep it. The build spec's §3.2 requires the field, it costs nothing, and removing it would be the one change that makes reverting D12 expensive. Treat it as vestigial, not as logic. |

---

## Summary

Two entries were withdrawn and five added across the build. Current shape after
Phase 8: **54 closed, 1 withdrawn, 5 open** of 60.

- **7 × S1 the spec does not mention** — C1 (hydration), C2 (stale cart ids),
  D1 (cart contents recommended), **D1a (cart *tiles* recommended)**, D2 (undefined
  slot backfill), E2 (false history claim on never-bought rows), **E10 (false
  history claim on dormant rows — which the spec's own example commits)**.
- **Every S1 is now closed.** The two that were open through Phase 5, E1 and E2,
  were closed in Phase 6 and verified: no key in the built client bundle, and no
  purchase claim reachable on a slot-B line.
- **The only remaining open items are Phase 9 (H3, H4), plus D7, H2 and E11.**
  None is an S1. Everything reachable before deploy is closed.
- **Phase 8's audit found a defect the register had not predicted:** the panel's
  own row stepper removed a product with no `cart_remove`. Not a listed case —
  it was a call site that drifted from D22 after the rule was written. The rule
  now has one implementation (`cartActions.ts`) instead of three.
- **E11 is the one to watch before a demo.** It is not a code defect — the panel
  degrades correctly — but it is the reason a live walkthrough can show
  `fallback_ratelimit` on the second cart while everything looks fine on the
  first.
