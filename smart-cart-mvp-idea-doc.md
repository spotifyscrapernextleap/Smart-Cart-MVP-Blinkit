# Smart Cart — MVP Idea Doc

**Product:** Blinkit
**Feature:** Smart Cart — an exploration panel on the checkout page
**Status:** Idea consolidated, ready for engineering requirements
**Scope of this doc:** Problem, behaviour, rules, and measurement. No stack, architecture, or effort estimates — those get derived from this, not decided here.

---

## 1. Problem Statement

Blinkit users open the app with a specific item already decided and leave within minutes. Survey evidence (n=32) shows this is near-universal: depletion and occasion drive nearly every session, only 3 of 32 have ever opened the app because Blinkit prompted them to, and 24 of 32 go straight to a search box for a product they have already named.

The cost of that entry behaviour is measurable. **Of the 24 users who open by searching, 14 noticed nothing new on the platform all month. Of the 8 who enter any other way, only 1 did.** Entry behaviour, not the catalogue, determines what a user is capable of seeing. Every conventional discovery surface — home feed, category tiles, banners — is structurally unreachable for the majority of users, because they never pass through it.

The barrier is not rejection. Interview hypothesis H2 was validated: users do not actively refuse these categories, they simply do not consider Blinkit for them. Blinkit has not built mindspace. Finding F4 states the same thing from the other side — the catalogue does not resurface inside a habit-formed customer journey.

**The cart is the only screen in the app that no user can skip, regardless of how they entered.**

---

## 2. What This Is

A panel on the checkout page, sitting between the cart items and the Bill details block, that surfaces four products the user did not search for — split across two deliberate slot types — each carrying a one-line reason for its presence.

It is not a general recommendation widget. Two of the four slots are reserved for categories the user has never purchased from, at the deliberate cost of conversion rate. That reservation, and the reason line that makes it legible, is the feature.

### The strategic frame

The two slot types have different jobs and should be understood as a funnel, not a menu:

- **Dormant slots are the engine.** They surface categories the user has already bought from and let lapse. Trust is pre-cleared, history supplies a genuinely personal reason line, and these will carry the panel's conversion numbers. Their job is to earn the panel its attention and rebuild the habit of buying outside the core basket.
- **Never-bought slots are the goal.** They spend the credibility the dormant slots earn. They will convert at a fraction of the dormant rate. That is expected and priced in.

This is an exploration budget riding on an engine of familiarity. State it that way — it converts the panel's weakest-converting slot from an unexplained gamble into a stated strategy.

---

## 3. Goals

1. **Increase the percentage of monthly active Dabblers who purchase from at least one never-bought category per month.** This is the headline metric. Dormant reactivations do not count toward it.
2. **Increase reactivation of dormant categories** — a purchase from a category untouched for 30+ days.
3. **Increase downstream category activity.** Within 14 days of an impression, does search or browse activity in the surfaced category rise versus a holdout? This captures the priming effect on users who did not convert in-panel.
4. **Do not degrade checkout completion.** The panel sits between the user and their bill. Checkout completion rate and time-to-pay must not regress.

---

## 4. Non-Goals

1. **Not solving the trust barrier.** Quality doubt was cited by 16 of 32 — the single largest barrier. v1 addresses awareness and consequence-of-error only. Trust signals (certification, verified-seller badges, social proof counts) are P1.
2. **Not touching returns or refunds.** Hassle-free return was the second-most-named unlock (8 of 32). It is the largest available lever and it sits outside this feature. Name this limitation explicitly rather than omitting it.
3. **Not a cart-adjacent cross-sell.** "You may also like" for items already in the cart is current-state Blinkit and was deliberately cut. Every slot in this panel points away from the current basket.
4. **Not serving all users.** Restockers, Tourists, Adopters and sub-6-month users are out of scope for v1.
5. **Not an AOV feature.** When category footprint and basket value conflict, footprint wins. See the price ceiling rule.

---

## 5. Eligibility

Two independent conditions, both required. These are frequently collapsed and should not be.

**Tenure gate:** account age ≥ 6 months. This exists because Dabbler classification requires enough history for a pattern to emerge. It is a data-sufficiency condition, not a segment definition.

**Segment filter — Dabbler:** a user who has purchased from at least one category outside their core basket once or twice, and never established repeat purchase in it. (Reference: segmentation rungs — Restocker n=5, Tourist n=9, Dabbler n=14, Adopter n=3.)

**Open for engineering/data:** the exact query that classifies a Dabbler. What counts as "core basket," what order-count threshold separates Tourist from Dabbler, and what repeat pattern promotes a Dabbler to Adopter. This is blocking — the panel cannot target without it.

**No minimum cart size.** An earlier draft required two or more items; this was cut. Single-item orders are the most common quick-commerce basket and the most intent-locked, and excluding them removes the hardest and largest case.

---

## 6. Panel Composition

Four products, two slot types, two products each.

### Slot type A — Dormant (2 products)

A category from which the user has placed no order in the last 30 days or more.

Reason line is user-specific and drawn from their own history. Examples:
- "You last ordered this 7 weeks ago"
- "You used to order this monthly"

### Slot type B — Never-bought (2 products)

A category from which the user has never purchased.

**Selection default: area bestseller.** Every history-derived signal (household composition, taste, seasonality) is inferred from purchase history, which by definition contains no trace of a never-bought category. Area-level bestseller data is the one signal that escapes this. Use it as the default, not the fallback. Household-composition inference can refine ranking within the bestseller set, not replace it.

**Reason line is inference-based, and it is thinner than the dormant line. This is a known weakness.** No user-specific fact exists for a never-bought category. The best available construction is basket-inference plus locality:
- "Most households ordering weekly staples keep this"
- "Popular with households near you"

**Price ceiling — the v1 trust lever.** Finding F3 states that blocked categories are blocked by consequence-of-error, not by category. A low-value first purchase in a refused category is a low-consequence trial. Never-bought suggestions must be capped relative to the current cart value.

This matters because 21 of 32 refuse electronics outright and 11 of 32 refuse beauty and personal care. Those categories are not excluded — but they enter at ₹200, not ₹2,000. (Reference quote: *"I don't think I'll ever buy anything on Blinkit that's more than even 2k."*)

**Open for product:** the exact ceiling. A ratio of cart value, an absolute cap, or the lower of the two. Non-blocking, but needs a number before launch.

### Diversity constraint

No two products from the same category or sub-category within the same panel. Without this, a history-weighted selector will converge on the most-depleted staple and surface it twice.

---

## 7. Interaction Model

### Appearance

- Panel loads automatically on the checkout page, positioned between the last cart item and the Bill details block.
- Vertical list, one product per row. Chosen over a horizontal carousel because it reads as a continuation of the cart, and because reason lines and future trust badges need horizontal width.
- Visually distinguished as provisional — currently a tinted background with a spark icon and dashed row separators, signalling "not yet in your cart."

**Design note, non-blocking:** dashed borders carry heavy coupon and promo connotation in Indian commerce UI, and an ad-styled block is the visual language users have trained themselves to skip — a real risk when trust is the dominant barrier. Consider retaining the tinted section background but removing individual row borders, so rows read as visibly less committed than the solid cards above without reading as an offer unit.

### Row actions

| Action | Behaviour |
|---|---|
| Add | Moves the product into the real cart above. The row vanishes from the panel. |
| Remove row | Dismisses that single suggestion for this session. |
| Browse & Replace | Opens a small popout of similar items, ranked by brands the user frequents and by price. Available on all four rows. |

**Required fix — the stepper is currently overloaded.** As drawn, the control is a `− 0 +` stepper. Minus at zero deletes the row; minus at one decrements to zero. One control, two meanings, with the destructive one as the default state. A user reducing quantity from 2 to 1 to 0 falls off a cliff into deletion.

Resolution: the row presents an **ADD** button that becomes a quantity stepper only after the first tap. Row dismissal is a separate, small, explicitly non-quantity control.

**Browse & Replace, note:** for a genuinely never-bought category, "brands the user usually frequents" does not exist. The popout needs a defined fallback ranking for this case.

### Panel-level actions

- **Dismiss (×):** collapses the panel for the session. The Smart Cart header remains, with an affordance to bring the suggestions back or reshuffle. Dismissal is logged as a signal and fed back into selection.
- **Bulk add (✓):** **recommended cut for v1.** A single tap that adds four unchosen products is the highest-regret action on the screen, it sits at the top with no undo, and it contradicts the panel's stated purpose — nobody wants all four. It also makes attribution meaningless. *Open decision, blocking for design.*

### State rules

- A product added from the panel disappears from the panel.
- If that product is subsequently removed from the real cart, it returns to the panel.
- **Open for product:** whether an added row is backfilled by a fifth suggestion or the panel simply shrinks. Recommendation: do not backfill in v1 — it keeps the exploration budget fixed and keeps attribution clean.

### Fatigue rule

If a user ignores or dismisses the panel across **5 consecutive sessions**, it stops auto-loading and persists as a collapsed, expandable section. This addresses banner blindness — the standard failure mode for always-on recommendation units — and converts inaction into a usable signal.

**Open for data:** what re-triggers auto-load. A time window, a manual expand, or a change in the user's category profile.

---

## 8. User Stories

**Primary — the tenured Dabbler**

- As a Dabbler who enters via search, I want to see products outside my usual basket at the one screen I cannot skip, so that I learn what Blinkit stocks without having to go looking.
- As someone who let a category lapse, I want to be reminded I used to buy it here, so that I can restock it without a separate search.
- As someone cautious about a new category, I want the first thing I'm shown from it to be cheap enough that being wrong doesn't matter.
- As someone interested but unconvinced by the specific product shown, I want to see similar options without leaving checkout.

**Rejection and edge paths**

- As a user in a hurry, I want to dismiss the panel in one tap and reach my bill.
- As a user who consistently ignores this, I want it to stop appearing unprompted.
- As a user who added something by mistake, I want to remove it and have the suggestion return, not vanish.

---

## 9. Requirements

### P0 — cannot ship without

1. Eligibility gate: tenure ≥ 6 months **and** Dabbler classification.
2. Four products, two dormant and two never-bought, with dormancy defined as no order from that category in 30+ days.
3. One reason line per product. **This is P0, not decorative** — H2 identifies mindspace as the problem, and the reason line is the only element in the design that builds it. A product tile without a reason is inventory.
4. Price ceiling on never-bought suggestions relative to cart value.
5. Category diversity constraint within a panel.
6. Add, remove-row, and panel-dismiss, with the stepper/ADD fix above.
7. Add → row vanishes; remove from real cart → row returns.
8. Fatigue rule at 5 consecutive ignores.
9. Slot-level event instrumentation: every impression, add, dismiss, and Browse & Replace open must be attributable to slot type A or B. **Aggregate panel metrics are useless for this feature** — dormant will dominate them and mask whether the never-bought slots did anything.
10. Holdout cohort of eligible users who never see the panel.

### P1 — fast follow

1. Trust signals on never-bought rows: verified-authenticity marks, purchase counts ("2,400 households ordered this week"), ratings. Cut from v1 on space and dependency grounds, but this addresses the largest stated barrier and should not sit in P1 for long.
2. Special-price treatment on never-bought rows, with struck-through original alongside the new price. **Only ship this with a mechanism to separate recommendation lift from discount lift** — otherwise this becomes a promo engine in a recommendation wrapper and you will never know which half worked.
3. Backfill behaviour after an add.
4. Reshuffle from the collapsed header.

### P2 — design for, don't build

1. Extension beyond Dabblers to Tourists and Restockers, each of which likely needs a different slot ratio.
2. Post-conversion follow-through — the mechanism that brings a never-bought converter back next month. **This is the acknowledged hole in the strategy.** F2 states that trial is forced substitution and does not become habit; the fifth pain point states that nothing initiates the second purchase after an occasion-based new-category order. This MVP produces trials. It does not produce habits, and a metric reading "one new category every month" does not compound off one-time trials.
3. Category-level trust interventions — returns, quality guarantees. Highest-value lever available, entirely outside this feature.

---

## 10. Success Metrics

**Measure slot types separately, always. Never report a blended panel number as the headline.**

### Leading (days to weeks)

| Metric | Definition |
|---|---|
| Panel impression rate | % of eligible checkout sessions where the panel loads |
| Add rate, slot A | Adds ÷ impressions, dormant rows |
| Add rate, slot B | Adds ÷ impressions, never-bought rows |
| Dismiss rate | Panel-level × taps ÷ impressions |
| Fatigue rate | % of eligible users reaching 5 consecutive ignores |
| Browse & Replace open rate | By slot type |
| Checkout completion delta | Panel cohort vs. holdout — guardrail, must not regress |

### Lagging (weeks to months)

| Metric | Definition |
|---|---|
| **New-category conversion (headline)** | % of MAC in cohort purchasing from a never-bought category per month, vs. holdout |
| Dormant reactivation rate | % purchasing from a 30+ day dormant category, vs. holdout |
| 14-day downstream category activity | Search/browse activity in a surfaced category within 14 days of impression, vs. holdout. This captures priming on non-converters. |
| Repeat rate on new-category conversions | Did a slot-B convert buy from that category again the following month? This is the number that tells you whether you built trials or habits. |

### The holdout is not optional

Success is currently defined so that conversion counts as success and non-conversion counts as priming. Without a matched holdout that never sees the panel, no result falsifies the feature and the 14-day activity number is noise read favourably. The holdout is what makes the priming claim a finding instead of an assertion.

### Kill criteria — **unresolved, must be set before launch**

The arithmetic to run:

- A Dabbler orders roughly 5 times a month.
- Two never-bought slots per order → ~10 never-bought impressions per user per month.
- Published cart cross-sell add rates sit in the low single digits for *familiar* items. A never-bought category with no trust badge, at the moment of highest exit intent, will be lower.
- 10 impressions × add rate = expected new-category purchases per user per month, which converts directly into a percentage-point change in the metric, since the metric is binary per user.

Run this at 2%, 0.5%, and 0.1%. The resulting deltas will tell you what the honest ceiling is. Then set the slot-B add rate, measured over a defined window, below which the panel is not worth its screen space. **Put this arithmetic and the resulting threshold in writing before launch, not after.**

---

## 11. Known Weaknesses

Stated plainly, because a doc that names its own holes is more useful than one that doesn't.

1. **The never-bought reason line is structurally weaker than the dormant one.** No user-specific fact exists. Every mechanism this feature adds — history as fuel, trust from prior purchase, personal reason line — works cleanly on dormant and degrades on never-bought. The dormant half of this feature is materially stronger than the new-category half.
2. **The largest barrier is unaddressed in v1.** Trust (16 of 32) is addressed only indirectly, via the price ceiling. Awareness-blocked users cap at 13 of 32. v1 is aimed at the smaller half of the problem.
3. **Most likely failure mode:** dormant slots carry the panel's numbers, never-bought slots convert at a fraction of a percent, and slot allocation quietly drifts toward whatever the dashboard rewards. The feature survives; the goal doesn't. The defence is slot-level instrumentation and a pre-committed kill threshold — both P0 above.
4. **Reduced to its core, this is a slot-allocation change plus a reason line on an existing recommender.** That is good for feasibility and worth being honest about when positioning the work.

---

## 12. Blocking Open Questions

| # | Question | Owner |
|---|---|---|
| 1 | The Dabbler classification query — core-basket definition, order thresholds, promotion rules | Data |
| 2 | Ship or cut the bulk-add tick | Design / Product |
| 3 | Price ceiling: ratio, absolute, or lower-of | Product |
| 4 | Slot-B add rate and window that constitute failure | Product |
| 5 | Holdout size and assignment method | Data |
| 6 | Browse & Replace ranking fallback for never-bought categories | Product / Eng |
| 7 | What re-triggers auto-load after the fatigue rule fires | Product / Data |
