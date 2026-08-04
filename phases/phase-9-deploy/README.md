# Phase 9 — Deploy

**Status:** ✅ complete — deployed, and the spec's test passes on the production URL
**Live:** <https://smart-cart-mvp-blinkit.vercel.app>
**Build spec reference:** §6 Phase 9 (9.1–9.3), §7.1–7.2
**Edge cases closed:** H2, H3, H4 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

It took two false starts to get there, both of which produced a 404 that
looked like a broken app and was not. Both are written up under Gotchas
below, because each is a trap that costs an hour if you have not seen it.

This phase has no code and no verify suite — spec 9.1–9.3 is entirely
infrastructure (a GitHub push and a Vercel import), which needs the project
owner's own accounts and credentials. What this session did is everything that
*can* be checked from inside the repo before that handoff, so the push and
import are the only two steps left, and neither can silently go wrong.

## Pre-flight checks performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src --max-warnings 0` | clean |
| `npm run build` | clean — 16 routes, 9 static `category/[tile]` pages (D37) |
| All 9 phase verify suites | 366/366 (see root `PROJECT_MEMORY.md` § Commands) |
| `git log --all --oneline -- .env.local` | empty — never committed (H4) |
| `git log --all -p -- .env.local .env` | empty — no accidental key commit |
| `grep -rl "gsk_\|GROQ_API_KEY" .next/static/` after a production build | empty — key does not leak into the client bundle (E1, re-checked before deploy per its own mitigation note) |
| `.env.example` | present, committed, template-only (`GROQ_API_KEY=`) |
| `.gitignore` | covers `.env.local` and `.env*.local` |

Nothing here was found broken. The repo is deploy-ready as of this commit.

## Why this session did not push or deploy

Two of spec 9.1–9.2's three actions need something this session does not have:

- **9.1 (push to GitHub)** needs a valid, authenticated `git`/`gh` credential
  tied to the owner's GitHub account. Pushing code is also a
  visible-to-others action, so it is the owner's call regardless of whether
  the credential is available.
- **9.2 (import into Vercel)** is done through Vercel's dashboard, which
  requires an interactive OAuth login to GitHub from inside Vercel — not
  something that can be scripted from a repo checkout.

So 9.1–9.3 are the owner's steps, run once, using the commands below.

## What to run — 9.1, push to GitHub

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin master
```

(Or `gh repo create <repo-name> --private --source=. --push` if `gh auth
status` succeeds — it does not need to for the plain `git push` path above.)

**Before pushing**, confirm the check this README already ran once more,
since new commits may have landed since:

```bash
git log --all --oneline -- .env.local   # must print nothing
```

## What to run — 9.2, import into Vercel

1. [vercel.com/new](https://vercel.com/new) → import the GitHub repo just
   pushed. Next.js is auto-detected; no build-command changes needed.
2. **Project Settings → Environment Variables** → add
   `GROQ_API_KEY` = the same value from local `.env.local`, scoped to
   Production (and Preview, if you want PR previews to also hit the model).
3. Deploy.

## Test results — the spec's Phase 9 test

> *On the deployed URL, a full flow completes. `recommend_call.outcome` reads
> `model`, not `fallback`.*

**PASS.** From `sc_events` on `smart-cart-mvp-blinkit.vercel.app`:

```json
{ "type": "recommend_call", "latencyMs": 1482, "outcome": "model" }
```

1482ms against a 4000ms abort, and inside the 1.3–2.0s range measured locally
— so the deploy region (Mumbai, `bom1`) is close enough to Groq and the env
var is set. Neither of the two things this test exists to catch is present.

| Check | Result |
|---|---|
| `/`, `/cart`, `/search`, `/category/pet-store` | all HTTP 200 |
| `/api/recommend` | HTTP 200, `"outcome":"model"`, 1.59s |
| Panel renders on the deployed cart page | 4 rows, reason lines, Browse & replace, ADD, Hide |
| Invariants 1–6 on the production response | 4 rows · 4 distinct tiles · A,A,B,B · slot A dormant, slot B never-bought · slot B under the ₹100 ceiling (₹97, ₹70) · nothing from the cart or its tile |
| Model is genuinely choosing (D33) | picks came back rank 1, 6, 17, 28 — three of four off rank 1, so the prompt has not regressed into reproducing `products[0]` |
| Three consecutive carts in one minute | all three `model` — D33's token mitigation holds in production (E11) |

The panel as served, on a cart holding one packet of Maggi noodles:

| Slot | Product | Reason |
|---|---|---|
| A | Hide & Seek Choco Rolls | *You last ordered from Bakery & Biscuits 10 weeks ago* |
| A | Microfibre Cleaning Cloth | *You last ordered from Cleaners & Repellents 5 weeks ago* |
| B | LED Bulb 0.5W | *Popular with households near you* |
| B | Agarbathi Variety Combi | *Common alongside weekly staples* |

Both slot-A lines name their tile and not the product (E10); neither slot-B
line claims a purchase (E2).

**Still not done: the UI has never been reviewed by eye.** Screenshots failed
again here — the browser pane does not composite, so
`computer{action:"screenshot"}` times out, exactly as in every prior session.
Everything above is DOM text and measured geometry. A human should still look
at the deployed URL on a real phone.

## What to run — 9.3, verify on the production URL

Open the deployed URL on a phone and run a full flow: search or browse →
add to cart → open cart → let the Smart Cart panel resolve.

**The one test that matters** (this is what H3 exists to catch): inspect
`sc_events` in that session — `recommend_call.outcome` must read `"model"`.

| If it reads | Diagnosis |
|---|---|
| `"model"` | Working as built. Phase 9 done. |
| `"fallback_nokey"` | `GROQ_API_KEY` was not set in the Vercel project, or was set on the wrong environment (e.g. Preview only, viewing Production). |
| `"fallback_timeout"` | The deploy region is too far from Groq's endpoint for the 4s budget (`MODEL_TIMEOUT_MS`). The panel still renders correctly — this is a latency finding, not a correctness bug. |
| `"fallback_error"` | Something else failed model-side; check the function logs in the Vercel dashboard for the actual error. |

A fallback panel and a model panel are visually identical (D31) — this is
exactly why `outcome` was added to the response beyond the spec's own shape.
Reading it is the only way to know which one shipped.

## Gotchas

- **The first deploy 404'd, and the cause was a branch mismatch, not the app.**
  The repo was created on GitHub with a README, which created `main` and made
  it the **default** branch. The app was pushed to `master`. Vercel builds the
  *default* branch for Production, so it cloned `main`, found one file
  (`README.md`) and no `package.json`, and produced nothing:

  ```
  WARNING! Build output contains no "functions" or "static" directory
  Build Completed in /vercel/output [13ms]
  ```

  **A 13ms "successful" build is the tell** — a real Next.js build of this repo
  takes seconds and prints a route table. A build that succeeds with no route
  table has not built this app, and the 404 that follows is Vercel correctly
  serving an empty deployment. Nothing in the app, the env vars or the Vercel
  settings was wrong.

  Fixed by merging the README commit into this history
  (`git merge origin/main --allow-unrelated-histories`) so
  `git push origin master:main` was a fast-forward, then moving development
  onto `main`. The alternative — repointing Vercel's Production Branch at
  `master` — was rejected: it leaves the repo's default branch showing a stub
  README, which misleads anyone browsing the repo and re-breaks on any future
  re-import.
- **The branch mismatch also poisoned Vercel's framework detection, and that
  caused a *second* 404 after the branch was fixed.** Framework Preset is
  decided **at import time** and then stored on the project. Because `main`
  held only a README when the project was imported, detection found no
  `package.json` and set the preset to **"Other"**. Moving the app onto `main`
  did not revisit that decision — so the next build ran install and compile
  (33s, status "Ready"), then ignored `.next/` and published `public/` as a
  flat static site.

  The symptom is diagnosable from outside the dashboard, which is worth
  knowing because it distinguishes this from every other 404:

  ```
  /                    404
  /cart                404
  /api/recommend       404
  /images/p_00001.png  200   ← public/ is being served; the app is not
  ```

  **A static asset serving while every route 404s means the framework preset
  is wrong**, not the code. Fixed in Settings → Build and Deployment →
  Framework Settings → Framework Preset → `Next.js`, then redeploy with the
  build cache disabled. A correct build prints a route table (16 routes,
  including `ƒ /api/recommend`); a build that finishes quietly has not built
  this app.

  **The general lesson: import the project only after the code is on the
  default branch.** Importing an empty or README-only repo silently commits
  the project to the wrong preset, and nothing later un-commits it.
- **`git log --all` also has to be checked, not just `git log`** — a key
  committed and later reverted on the same branch is invisible to `git log`
  on `HEAD` but still sits in history and is still pushed. This repo has
  never had a second branch, so `--all` and plain `git log` were equivalent
  here, but the check is written the safe way regardless.
- **Node version is unpinned.** `package.json` has no `engines` field; this
  repo was built on Node 24.15.0 locally, one major ahead of the spec's
  stated 18.17+ prerequisite. Vercel's own Next.js 16 default runtime covers
  this, so no `engines` entry was added — if a future Vercel default ever
  regresses below Next 16's minimum, that will surface as a build failure in
  the Vercel dashboard, not as a local symptom.
