"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// .js on purpose: build spec non-negotiable #1 is that this config file is
// byte-identical in both apps, and the other app is plain React + Vite.
// `allowJs` is on, so TypeScript still infers its shape — the file is checked,
// it just is not written in TypeScript.
import { DISCLAIMER, TYPE_LABELS } from "../disclaimer.config.js";

/**
 * Supporting documents panel — build spec "Supporting Documents Panel", §5.
 *
 * A dependency-free modal that opens once per page load and lists every
 * supporting artefact as a working link. The deck was exported through a
 * virtual PDF printer that stripped its hyperlink annotations; this is the
 * recovery path.
 *
 * The markup, the CSS block and the visual tokens are the spec's, unchanged.
 * **Two things had to differ, both because of this repo specifically:**
 *
 * 1. **The mount mechanism.** The spec opens with `setOpen(true)` inside a
 *    mount effect. This repo runs `eslint --max-warnings 0` with
 *    `react-hooks/set-state-in-effect` active, which makes that an *error*,
 *    not a warning — the same rule that forced D21's `useSyncExternalStore`
 *    rewrite in Phase 3. So the panel opens by *default* and the client-only
 *    signal comes from `useSyncExternalStore`, whose `getServerSnapshot`
 *    parameter is the sanctioned way to say "closed on the server, open on the
 *    client" without a manual effect — and therefore without reintroducing the
 *    hydration mismatch (C1) that a lazy `useState` initialiser would.
 *    Behaviour is identical to the spec's.
 *
 * 2. **The re-open pill sits higher than `bottom: 20px`.** This app has sticky
 *    bottom chrome the spec could not have known about: the checkout's Place
 *    Order bar occupies the bottom 71px, and `ViewCartBar` roughly 60px. At
 *    the spec's offset the pill lands inside the green CTA. See `FAB_BOTTOM`.
 */

const STYLE_ID = "nldl-styles";
const SESSION_KEY = "nldl-seen";

/**
 * Distance from the bottom edge to the re-open pill.
 *
 * 71px clears the tallest sticky bar in this app (measured on /cart), plus a
 * 13px gap, plus the iOS home-indicator inset — the same `env()` treatment
 * `ViewCartBar` and `PlaceOrderBar` already use (F8). Deliberately a constant
 * rather than bar detection: on a page with no bottom bar the pill simply
 * floats a little higher, which costs nothing, whereas a pill buried under a
 * primary CTA is unreachable.
 */
const FAB_BOTTOM = "calc(84px + env(safe-area-inset-bottom))";

const CSS = `
.nldl-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;
justify-content:center;padding:24px;background:rgba(17,17,17,.55);
animation:nldl-fade .14s ease-out}
.nldl-card{box-sizing:border-box;width:100%;max-width:560px;max-height:min(84vh,720px);
display:flex;flex-direction:column;background:#fff;border:1px solid #E6E6E6;border-radius:14px;
box-shadow:0 18px 48px rgba(0,0,0,.22);overflow:hidden;animation:nldl-rise .16s ease-out;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
color:#111;text-align:left}
.nldl-card *{box-sizing:border-box}
.nldl-head{display:flex;align-items:flex-start;gap:12px;padding:22px 24px 14px;
border-bottom:1px solid #EEE}
.nldl-title{flex:1;margin:0;font-size:17px;font-weight:600;line-height:1.3;color:#111}
.nldl-close{flex:none;width:44px;height:44px;margin:-10px -10px 0 0;display:flex;
align-items:center;justify-content:center;background:none;border:none;border-radius:8px;
font-size:20px;line-height:1;color:#6B6B6B;cursor:pointer}
.nldl-close:hover{background:#F5F5F5;color:#111}
.nldl-body{flex:1;overflow-y:auto;padding:18px 24px}
.nldl-note{margin:0 0 12px;font-size:14px;line-height:1.6;color:#3A3A3A}
.nldl-note:last-of-type{margin-bottom:4px}
.nldl-gh{margin:20px 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;
letter-spacing:.08em;color:#6B6B6B}
.nldl-link{display:flex;align-items:center;gap:12px;min-height:44px;margin-bottom:8px;
padding:11px 12px;border:1px solid #EDEDED;border-radius:9px;text-decoration:none;
background:#fff;transition:background .12s,border-color .12s}
.nldl-link:hover{background:#FAFAFA;border-color:#D8D8D8}
.nldl-ltext{flex:1;min-width:0}
.nldl-llabel{display:block;font-size:14px;font-weight:500;line-height:1.35;color:#111}
.nldl-ldesc{display:block;margin-top:2px;font-size:12.5px;line-height:1.4;color:#6B6B6B}
.nldl-badge{flex:none;padding:3px 7px;border:1px solid #E4E4E4;border-radius:5px;
background:#F2F2F2;font-size:10.5px;font-weight:600;text-transform:uppercase;
letter-spacing:.03em;color:#555;white-space:nowrap}
.nldl-arrow{flex:none;font-size:13px;color:#9A9A9A}
.nldl-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;
padding:14px 24px 18px;border-top:1px solid #EEE}
.nldl-fnote{flex:1;margin:0;font-size:12px;line-height:1.5;color:#6B6B6B}
.nldl-btn{flex:none;padding:9px 14px;min-height:40px;border:1px solid #DDD;border-radius:8px;
background:#fff;font-size:13px;font-weight:500;color:#111;cursor:pointer}
.nldl-btn:hover{background:#F5F5F5}
.nldl-fab{position:fixed;right:20px;bottom:${FAB_BOTTOM};z-index:2147482999;min-height:44px;
padding:11px 16px;border:1px solid #DDD;border-radius:999px;background:#fff;
box-shadow:0 4px 14px rgba(0,0,0,.14);font-size:13px;font-weight:500;color:#111;cursor:pointer;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.nldl-fab:hover{background:#F7F7F7}
.nldl-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
clip:rect(0 0 0 0);white-space:nowrap;border:0}
.nldl-backdrop :focus-visible,.nldl-fab:focus-visible{outline:2px solid #111;outline-offset:2px}
@keyframes nldl-fade{from{opacity:0}to{opacity:1}}
@keyframes nldl-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (max-width:640px){
  .nldl-backdrop{align-items:flex-end;padding:0}
  .nldl-card{max-width:none;max-height:92vh;border-radius:16px 16px 0 0;border-bottom:none}
}
@media (prefers-reduced-motion:reduce){
  .nldl-backdrop,.nldl-card{animation:none}
}`;

function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Whether this browser session has already seen the panel.
 *
 * Memoised at module scope and read exactly once per page load, because
 * `useSyncExternalStore` requires a snapshot that does not change unless the
 * store does. Reading `sessionStorage` live would flip to `true` the moment
 * the open-effect writes the flag, and the panel would close itself.
 */
let suppressedThisSession: boolean | null = null;

function getSuppressed(): boolean {
  if (suppressedThisSession === null) {
    if (!DISCLAIMER.suppressWithinSession) {
      suppressedThisSession = false;
    } else {
      try {
        suppressedThisSession = Boolean(sessionStorage.getItem(SESSION_KEY));
      } catch {
        // Private mode throws on access — fall through and open, which is the
        // safe failure direction.
        suppressedThisSession = false;
      }
    }
  }
  return suppressedThisSession;
}

/** Never changes during a page load, so the subscribe callback is a no-op. */
const subscribeNever = () => () => {};
/** Server render: suppressed, i.e. closed. Client: whatever the session says. */
const shouldOpenOnClient = () => !getSuppressed();
const shouldOpenOnServer = () => false;

const FOCUSABLE =
  'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

interface DocLink {
  label: string;
  url: string;
  type?: string;
  description?: string;
}
interface DocGroup {
  heading?: string;
  links: DocLink[];
}

export default function SupportingDocsPanel() {
  // Opens by default; `dismissed` is the only thing the user changes. Nothing
  // here calls setState from an effect — see the note at the top of the file.
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  const wantsOpen = useSyncExternalStore(
    subscribeNever,
    shouldOpenOnClient,
    shouldOpenOnServer,
  );
  const open = wantsOpen && !dismissed;

  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<Element | null>(null);

  const close = useCallback(() => {
    setDismissed(true);
    const target = returnRef.current;
    // `setTimeout`, not `requestAnimationFrame` as the spec has it: rAF does
    // not fire while the page is not compositing (a backgrounded tab, or this
    // project's browser pane — a gotcha already recorded in PROJECT_MEMORY),
    // and focus restoration silently never running is an accessibility bug
    // nobody would notice. A timer fires either way.
    setTimeout(() => {
      // `document.body` is what `activeElement` reports when nothing was
      // focused — which is the normal case, because the panel opens by itself
      // on page load. Focusing it is a no-op (body takes no focus without a
      // tabindex), so a keyboard user would be dumped at the top of the
      // document with no idea where the dialog went. Treat it as "no return
      // target" and hand focus to the pill instead, which is also what the
      // spec's §8 checklist asserts.
      const usable =
        target instanceof HTMLElement && target !== document.body && document.contains(target);
      if (usable) target.focus();
      else fabRef.current?.focus();
    });
  }, []);

  // Scroll lock + focus management + key handling while open.
  useEffect(() => {
    if (!open) return;

    injectStyles();

    // Marking the session seen is an external-system write, not a state
    // update, so it belongs in an effect and trips no lint rule.
    if (DISCLAIMER.suppressWithinSession) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* private mode — nothing to persist, panel just opens again */
      }
    }

    returnRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  // The pill is present from the first client paint, so its styles must be too.
  useEffect(() => {
    injectStyles();
  }, []);

  const copyAll = async () => {
    const text = (DISCLAIMER.groups as DocGroup[])
      .flatMap((g) => g.links.map((l) => `${l.label} — ${l.url}`))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        ref={fabRef}
        className="nldl-fab"
        onClick={() => setDismissed(false)}
        aria-haspopup="dialog"
      >
        Supporting documents
      </button>

      {open && (
        <div
          className="nldl-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={cardRef}
            className="nldl-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nldl-title"
            aria-describedby="nldl-note-0"
          >
            <div className="nldl-head">
              <h2 id="nldl-title" className="nldl-title">
                {DISCLAIMER.title}
              </h2>
              <button ref={closeRef} className="nldl-close" onClick={close} aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div className="nldl-body">
              {(DISCLAIMER.note as string[]).map((p, i) => (
                <p key={i} id={`nldl-note-${i}`} className="nldl-note">
                  {p}
                </p>
              ))}

              {(DISCLAIMER.groups as DocGroup[]).map((group, gi) => (
                <div key={gi}>
                  {group.heading && <div className="nldl-gh">{group.heading}</div>}
                  {group.links.map((link, li) => (
                    <a
                      key={li}
                      className="nldl-link"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="nldl-ltext">
                        <span className="nldl-llabel">{link.label}</span>
                        {link.description && (
                          <span className="nldl-ldesc">{link.description}</span>
                        )}
                      </span>
                      <span className="nldl-badge">
                        {TYPE_LABELS[link.type as keyof typeof TYPE_LABELS] || TYPE_LABELS.link}
                      </span>
                      <span className="nldl-arrow" aria-hidden="true">
                        &#8599;
                      </span>
                      <span className="nldl-sr">(opens in a new tab)</span>
                    </a>
                  ))}
                </div>
              ))}
            </div>

            <div className="nldl-foot">
              <p className="nldl-fnote">{DISCLAIMER.footerNote || ""}</p>
              <button className="nldl-btn" onClick={copyAll}>
                {copied ? "Copied" : "Copy all links"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
