# Phase 6 — Model layer

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 6 (6.1–6.4), §4 Steps 8–10, §7.5
**Edge cases closed:** E1, E2, E3, E4, E5, E6, E7, E8, E9 — and **E10 added and
closed**, see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

The panel starts thinking. Everything the spec calls non-negotiable was already
enforced in Phase 4, before a model existed, so this phase adds judgement and
nothing else: the model chooses *which* of the already-legal candidates suits
this cart, and writes the line explaining why. It cannot break a rule it was
never given the opportunity to break.

The model runs on **GPT-OSS 120B**, not the spec's `llama-3.3-70b-versatile` —
an owner decision, recorded as **D32**. D33 records the prompt-size change the
free tier's token limit forced.

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/recommend/prompt.ts` | System prompt and the JSON payload of cart + seven shortlists. |
| `src/lib/recommend/validate.ts` | JSON extraction, per-entry validation, per-tile resolution, backfill. |
| `src/app/api/recommend/route.ts` | The model call, the 4s abort, and every failure route. |
| `src/lib/config.ts` | `GROQ_MODEL` changed; five constants added. |
| `src/lib/recommend/fallback.ts` | `SLOTS_PER_TYPE` exported; `buildRows` no longer keeps an orphaned reason. |
| `src/lib/recommend/templates.ts` | `weeksAgoFrom` exported so prompt and template agree. |
| `.env.example` | Committed, empty. Required by spec §7.2 and previously missing. |

## How to run

```bash
node phases/phase-6-model/verify_model.ts
```

The suite needs **no key and no network**. It drives the real validation code
with hand-written model responses, which is the only way to produce a
hallucinated id or a false history claim on demand rather than waiting for one.

## Test results

### Spec test

> *With a valid key, the response has `source: "model"` and reason lines that
> vary with cart contents. Then: (a) unset `GROQ_API_KEY` — panel still renders,
> `source: "fallback"`; (b) set `MODEL_TIMEOUT_MS` to 1 — panel still renders,
> `source: "fallback"`. Build a snacks-only cart and confirm the dormant pet
> product is a consumable that suits it, not the durable the persona already
> owns.*

**PASS**, all clauses verified live against the Groq API.

| Clause | Evidence |
|---|---|
| `source: "model"` | `outcome: "model"`, `latencyMs` 1352 in `sc_events`, panel rendered in the browser |
| Lines vary with the cart | Snacks + soap cart → Cleaners / Bakery / Electronics / Home & Lifestyle; dog-food cart → different tiles, different ranks, different products |
| (a) no key | `source: "fallback"`, `outcome: "fallback_nokey"`, four rows, 37ms |
| (b) `MODEL_TIMEOUT_MS = 1` | `source: "fallback"`, `outcome: "fallback_timeout"`, four rows, 158ms |
| Consumable pet pick, not the durable | `p_02159` Padded Harness never appears; it is filtered out of the shortlist before the model sees it |

### Verification suite — 80/80

| Group | Checks |
|---|---|
| The history-claim detector, against the shipping regex | 13 |
| Reason sanitising (E2, E8, E10) | 11 |
| Extracting JSON from what the model returns (E5) | 7 |
| A well-formed response is honoured | 7 |
| Hallucinated ids degrade rather than render (E3) | 5 |
| A hallucinated id does not drag its reason line along | 3 |
| Two picks from one tile, cross-slot picks (E4, D5) | 4 |
| A false history claim never reaches slot B (E2) | 4 |
| An over-long line is replaced, the pick is kept (E8) | 3 |
| Responses rejected wholesale | 7 |
| The non-negotiables still hold on a model panel (spec §1) | 6 |
| The prompt (spec §4 Step 8) | 9 |
| Determinism | 1 |

## What the model actually changed

The measurable result, on the snacks-and-staples cart PROJECT_MEMORY names as
the Phase 6 success criterion:

| | Deterministic | Model |
|---|---|---|
| Dormant 1 | Dish Wash, rank 1 | **Compostable Garbage Bags, rank 4** — the persona's own lapsed staple |
| Dormant 2 | Pet Food Variety Stix, rank 1 | Multigrain Biscuit, rank 3 — bakery, not pet food, for a snacks cart |
| Never-bought 1 | **Peristaltic Nipple — 'S' Hole**, rank 1 | Baby Wipes, rank 3 |
| Never-bought 2 | Battery AA, rank 1 | Battery AA, rank 1 |

Three of four rows moved off rank 1, and the one implausible suggestion the
deterministic path is documented as producing is gone. This did not happen with
the first prompt — see D33 and the gotcha below.

## Edge cases closed

| # | How |
|---|---|
| **E1** | Key read only in `route.ts`; `grep gsk_` and `grep GROQ_API_KEY` over `.next/static/` after a production build return nothing. |
| **E2** | `CLAIMS_HISTORY` applied to every slot-B line. A hit discards the **line**, not the pick, and the template replaces it. |
| E3 | A pick whose id is in no shortlist is dropped and the slot refilled. Reaches the panel as a real product or not at all. |
| E4 | A tile already used rejects the second pick; four distinct tiles asserted by construction. A dormant id offered as never-bought is rejected. |
| E5 | ` ``` ` fences, leading prose and inline `<think>` blocks stripped before parsing. |
| E6 | 4s `AbortController`; `fallback_timeout` / `fallback_ratelimit` / `fallback_invalid` / `fallback_error` distinguished. All four observed except `fallback_error`. |
| E7 | `GROQ_MODEL` pinned in `config.ts`; a 404 maps to `fallback_error`, never an unhandled throw. |
| E8 | Length rejected against `REASON_MAX_CHARS`; exclamation marks stripped rather than rejected. |
| E9 | Catalogue text enters the prompt as JSON string values, never as prompt lines. |
| **E10** | *New.* A dormant line must contain its tile label, or the template replaces it. |

## Gotchas

- **The first prompt produced the same panel as the deterministic path.** Every
  pick came back as rank 1, including the implausible baby-care one this phase
  exists to fix. The lists are handed to the model in bestseller order and it
  took the top of each. What changed it was telling it so explicitly — *"listed
  in order of overall popularity, NOT in order of how well they suit this cart;
  the first product in a list is frequently the wrong answer"* — plus a concrete
  negative example. Without that sentence the model layer is an expensive way to
  reproduce `products[0]`.
- **The binding free-tier limit is tokens per minute, not requests.** Measured:
  1,000 requests/day but **8,000 tokens/minute**. The first prompt cost 4,729
  prompt tokens, so the *second* checkout visit inside a minute returned HTTP
  429 and served a fallback panel. Trimming the prompt to
  `MODEL_SHORTLIST_DEPTH` (6) and dropping JSON indentation took it to 2,072 —
  three calls a minute instead of one. Check `x-ratelimit-remaining-tokens`
  before concluding anything about a fallback panel.
- **Reasoning tokens count against `max_completion_tokens`.** A 16-token cap
  returned `finish_reason: "length"` with empty content and 14 reasoning tokens.
  At `reasoning_effort: "low"` the model spends ~330 reasoning tokens per call,
  well inside the 1,024 cap — but a cap sized for the visible answer alone would
  silently return nothing.
- **The SDK retries twice by default.** Both retries fall inside the same 4s
  abort, so they cannot produce a usable answer, and on a 429 they spend two
  more requests against the limit that just rejected us. `maxRetries: 0`.
- **Next 16 refuses to run a second dev server in the same directory** and exits
  immediately, which looks exactly like the route crashing the server. Three
  servers "died" on the first request before the log revealed
  `⨯ Another next dev server is already running`. If a server dies on request,
  read its log before suspecting the code.
- **The spec's own example dormant line is unsafe.** §4 Step 8 shows
  `"You used to order this regularly"` as a model response — a claim about the
  specific product, which is chosen by bestseller rank and is usually not one
  the persona ever bought. That is E2's failure mode on slot A, and the register
  did not cover it. Now E10.
