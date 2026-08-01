# Phase 1 — Scaffold and shell

**Status:** complete, all tests pass
**Build spec reference:** §6 Phase 1 (1.1–1.4), §7.4
**Edge cases closed:** C1, C3, C4, C6 — see [`../../EDGE_CASES.md`](../../EDGE_CASES.md)

Establishes the app: Next.js at the repo root, the two files every later phase
imports (`types.ts`, `config.ts`), the storage wrapper, and the mobile shell.

## What this phase produced

| File | Purpose |
|---|---|
| `src/lib/config.ts` | Every tunable, spec §7.4 verbatim. No constant in it may be hardcoded elsewhere. |
| `src/lib/types.ts` | `Product`, `Tile`, `Order`, `AppEvent`, `RecommendResponse`, `PanelRow` and friends, mirroring `/data` exactly. |
| `src/lib/storage.ts` | Typed localStorage wrapper. SSR-safe, corrupt-value-safe, works when storage throws. |
| `src/lib/session.ts` | Session creation and `?reset=1`. |
| `src/components/AppBootstrap.tsx` | Runs reset-then-session once per load, in an effect. |
| `src/app/layout.tsx` | Root layout, 480px centred shell. |
| `src/app/globals.css` | Tailwind v4 entry, palette, clamp helpers. |
| `src/app/page.tsx` | **Throwaway shell** — replaced by Home in Phase 2. |

## Installed versions

Next **16.2.12**, React **19.2.4**, Tailwind **4**, TypeScript 5, Node 24.15.

## How to run

```bash
npm install
npm run dev
```

Then `node phases/phase-1-scaffold/verify_storage.ts` for the storage suite.

## Test results

### Spec test

> *App runs at `/`, renders an empty shell. `?reset=1` clears localStorage and
> removes itself from the URL.*

**PASS.** Verified in a real browser at a 375×812 viewport.

- Shell renders; session is created on first load.
- Seeded all four keys, then loaded `/?reset=1&keep=abc`:
  - `sc_cart`, `sc_events`, `sc_panel_cache` → `null`
  - `sc_session` → regenerated with a new id, which is the correct reading of a reset
  - URL → `/?keep=abc`. The reset parameter is stripped; the unrelated parameter survives.
- No hydration errors or React warnings in the console.
- At a 500px viewport the shell measures 480px, is centred, and the body does not scroll horizontally.

### Storage suite — `verify_storage.ts`

**PASS — 12/12.** No test runner; Node 24 executes TypeScript directly, and the
spec is explicit about not adding unspecified dependencies.

| Group | Covers |
|---|---|
| No window | Every operation is callable during SSR and falls back to memory. |
| Hostile storage | A `Storage` that throws on *every* call — Safari private mode, exhausted quota. Nothing propagates; the app degrades to memory and warns once. |
| Corrupt values | Unparseable JSON, valid JSON of the wrong shape, one malformed line among good ones, and a `null` quantity. Each returns the caller's default **and clears the key**, so a bad value cannot fail twice. |
| clearAll | Removes every `sc_*` key. |

A corrupt `sc_session` was also planted in the live browser: it was detected,
cleared, and replaced with a valid session without the page failing to render.

## Decisions

Recorded in full as **D8–D11** in [`../../PROJECT_MEMORY.md`](../../PROJECT_MEMORY.md).
In brief: scaffolded via a temp directory to protect `public/images`; Tailwind v4
means there is no `tailwind.config.ts`; `config.ts` is kept byte-for-byte to spec
with new tunables deferred to the phases that need them; guards are shallow by
design and heal lazily on read.

## Not done here, on purpose

- No Fuse.js yet — Phase 2 installs it.
- `cart.ts` and `events.ts` do not exist. `sc_cart` and `sc_events` are declared
  in `STORAGE_KEYS` and shape-guarded, but nothing reads them until Phases 3 and 8.
- `page.tsx` is a diagnostic placeholder, not the Home screen.
