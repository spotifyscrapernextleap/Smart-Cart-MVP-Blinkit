# Phase 9 — Deploy

**Status:** pre-flight complete; the push and the Vercel import are owner-executed steps (see below for why)
**Build spec reference:** §6 Phase 9 (9.1–9.3), §7.1–7.2
**Edge cases addressed:** H3, H4 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md) (closed by the owner completing 9.2–9.3, not by this session)

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
