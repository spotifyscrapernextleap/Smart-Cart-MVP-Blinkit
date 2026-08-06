# Phase 11 — Supporting documents panel

**Status:** complete, all tests pass
**Not in the Smart Cart build spec.** Implements a separate document,
*"Build Spec — Supporting Documents Panel"*, as **App B**.
**Verification:** `node phases/phase-11-docs-panel/verify_docs_panel.ts` — 33/33
**Link check:** `node phases/phase-11-docs-panel/check_links.ts` — run before every submission

A dependency-free modal that opens once per page load and lists every
supporting artefact as a working link. The slide deck was exported through a
virtual PDF printer that stripped its hyperlink annotations; this is the
recovery path for an evaluator who reaches the app.

## What this phase produced

| File | Purpose |
|---|---|
| `src/disclaimer.config.js` | The only file to edit. **Must stay byte-identical to App A's copy.** |
| `src/components/SupportingDocsPanel.tsx` | The panel. Spec §5 markup and CSS, three deviations below. |
| `src/app/layout.tsx` | Mount point — in the layout, so it opens once per page load and not on client-side navigation. |
| `phases/phase-11-docs-panel/verify_docs_panel.ts` | Config integrity, offline and instant. |
| `phases/phase-11-docs-panel/check_links.ts` | Signed-out liveness check for every URL. |

Zero new dependencies, as required. No `package.json` or build-config change.

## Three deviations from the reference implementation

All three are forced by this repo, not preferences. Behaviour matches the spec
in every case.

**1. The mount mechanism — the spec's version does not build here.**

Spec §5 opens the panel with `setOpen(true)` inside a mount effect. This repo
runs `eslint --max-warnings 0` with `react-hooks/set-state-in-effect` active,
which makes that an **error**:

```
error  Calling setState synchronously within an effect can trigger cascading renders
  react-hooks/set-state-in-effect
```

That is the same rule that forced D21's `useSyncExternalStore` rewrite in Phase
3, and App A (Vite) almost certainly does not have it enabled — which is why
the spec never hit it. The panel now opens **by default** and takes its
client-only signal from `useSyncExternalStore`, whose `getServerSnapshot`
parameter is the sanctioned way to say "closed on the server, open on the
client" without a manual effect, and therefore without reintroducing the
hydration mismatch (C1) that a lazy `useState` initialiser would.

The session-suppression flag is memoised at module scope. Reading
`sessionStorage` live inside `getSnapshot` would flip to `true` the moment the
open-effect writes the flag, and the panel would close itself.

**2. The re-open pill sits at `bottom: 84px`, not `20px`.**

This app has sticky bottom chrome the spec could not have known about.
Measured on `/cart`:

| | Occupies from the bottom edge |
|---|---|
| Place Order bar | **0–71px** |
| Pill at the spec's `bottom: 20px` | **20–64px** |

Entirely inside the green CTA. `ViewCartBar` (~60px) collides on every other
page. `FAB_BOTTOM` is `calc(84px + env(safe-area-inset-bottom))` — clears the
tallest bar by 13px and respects the iOS home indicator, the same treatment
`ViewCartBar` and `PlaceOrderBar` already use (F8). Deliberately a constant
rather than bar detection: on a page with no bar the pill floats slightly
higher, which costs nothing, whereas a buried pill is unreachable.

**3. Focus restoration uses `setTimeout`, not `requestAnimationFrame`.**

Two bugs, one fix. rAF does not fire while the page is not compositing — a
backgrounded tab, or this project's browser pane, a gotcha already in
`PROJECT_MEMORY`. Focus restoration silently never running is an accessibility
failure nobody would notice.

And the target itself was wrong: `document.activeElement` is `<body>` when the
panel auto-opens on load, because nothing was focused. `<body>` takes no focus
without a `tabindex`, so the original code stranded keyboard users at the top
of the document. `<body>` is now treated as "no return target" and focus goes
to the pill — which is what the spec's own §8 checklist asserts.

## Test results

**33/33 config checks**, and the §8 behaviour checklist verified live in the
browser at 375px:

| Checklist item | Evidence |
|---|---|
| Opens on hard reload | `.nldl-backdrop` present after load |
| Does not re-open on internal navigation | closed → clicked back to `/` → still closed, pill still present |
| `Esc`, close button, backdrop click all close | all three verified |
| Re-open pill restores it | verified |
| Focus lands on close button on open | `activeElement.className === "nldl-close"` |
| Tab wraps within the card | 7 focusables; Tab from last → first |
| Focus returns to the pill on close | `activeElement.className === "nldl-fab"` |
| Body does not scroll while open | `body.style.overflow === "hidden"`, restored to `""` on close |
| Dialog semantics | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="nldl-title"`, `aria-describedby="nldl-note-0"` |
| All links open in a new tab | 5/5 `target="_blank" rel="noopener noreferrer"` |
| Badges resolve | Google Sheet, Google Doc ×3, Miro |
| Above all app chrome | `z-index: 2147483000` vs the app's highest `20`; `elementFromPoint` at centre returns panel content |
| Bottom sheet at 375px | `align-items: flex-end`, full width, radius `16px 16px 0 0`, flush to the bottom, body region scrolls |
| No horizontal overflow | `body.scrollWidth === 375` |
| No host style leakage | card font is the system stack, colour `#111` — Tailwind preflight does not reach in |
| No console errors | none |

**Links: 4/5 confirmed public signed-out**, by real title in the response
(`Survey responses - final blinkit`, `Questionnaire Blinkit`, `Transcripts -
Blinkit`, `Sources on Slide 1`). A 200 alone is not enough — Google serves 200
for its "Request access" wall, so `check_links.ts` inspects the body too.

**The Miro board is UNVERIFIABLE from here and needs a manual incognito
check.** Miro is a SPA whose server HTML is byte-identical whether the board is
public or private, so the script reports that honestly instead of guessing.

## Gotchas

- **The config must stay byte-identical to App A's.** It is `.js`, not `.ts`,
  purely for that reason — spec non-negotiable #1. `allowJs` is on so
  TypeScript still infers its shape; the file is checked, it just is not
  written in TypeScript. **Diff the two before submitting.**
- **`@ts-expect-error` on the config import is wrong here.** `allowJs: true`
  means the import resolves and is typed, so the directive is itself an error
  (`TS2578: Unused '@ts-expect-error' directive`). It was in the first draft of
  all three files.
- **The card appears to hang 8px below the viewport when measured.** It does
  not. `nldl-rise` starts at `translateY(8px)` and animations are frozen in the
  browser pane, so the card sits on its first keyframe forever. Finish them
  before measuring — `el.getAnimations().forEach(a => a.finish())` — and it is
  flush. Same gotcha as the Browse & Replace sheet in Phase 7.
- **`?reset=1` does not clear `nldl-seen`.** Different namespace, deliberately.
  Only matters if `suppressWithinSession` is ever set to `true`.
- **Panel events are not logged to `sc_events`.** That log is the Smart Cart
  feature's measurement surface; a submission-recovery modal is not part of the
  product and would only add noise to it.
- **Linking the GitHub repo would expose the author identity** on every commit,
  which is why it is not in the config. Spec §9 admits the equivalent leak for
  Google and Miro sharing UI but does not mention this one. Owner's decision.
- **The name check is only as good as its list.** `verify_docs_panel.ts` greps
  for the forms taken from this repo's git author identity. Another spelling
  would pass unnoticed — add it to `FORBIDDEN` if one exists.
