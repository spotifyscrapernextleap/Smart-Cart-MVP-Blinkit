"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getProduct } from "@/lib/catalogue";
import {
  addToCart,
  cartSignature,
  getCart,
  removeFromCart,
  setQuantity,
} from "@/lib/cart";
import { PANEL_ROW_EXIT_MS } from "@/lib/config";
import { logEvent } from "@/lib/events";
import { getCachedPanel, setCachedPanel } from "@/lib/panelCache";
import { useCart } from "@/lib/useCart";
import type { CartSignature, ProductId, RecommendResponse } from "@/lib/types";

import RecommendationRow, { PANEL_ROW_HEIGHT_CLASS } from "./RecommendationRow";

/**
 * The Smart Cart panel. (Build spec §4, Steps 1–3 and 12–13)
 *
 * Computed **once per visit**, on mount, and cached by cart signature. It does
 * not recompute when the cart changes — the panel was computed for the visit,
 * not for the cart, and that is precisely what stops the four rows reshuffling
 * while the user is reading them (spec §4 Step 13).
 *
 * A row added from the panel disappears; if the user later removes that product
 * from the cart, the row comes back in its original position with its original
 * slot. That falls out for free from deriving the visible rows by filtering the
 * response rather than mutating it. (EDGE_CASES F3)
 *
 * There is no backfill. The panel becomes three rows and stays three rows —
 * the exploration budget is fixed, which is what keeps attribution clean.
 */

const PANEL_ROW_COUNT = 4;

type PanelState =
  | { status: "loading" }
  | { status: "ready"; response: RecommendResponse }
  | { status: "empty" };

function PanelHeader({
  dismissed,
  onToggle,
}: {
  dismissed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--color-panel-accent)" }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
          <path d="M12 2l1.9 5.8L20 9.7l-4.6 3.6L16.2 20 12 16.7 7.8 20l.8-6.7L4 9.7l6.1-1.9z" />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] leading-tight font-bold"
          style={{ color: "var(--color-panel-accent)" }}
        >
          Smart Cart
        </p>
        <p className="text-[11px] leading-tight text-[var(--color-ink-muted)]">
          Suggested for you
        </p>
      </div>

      {/*
        Dismiss only. The prototype pairs this with a green bulk-add tick, but
        the idea doc §7 recommends cutting it for v1 — highest-regret action on
        the screen, no undo, and it makes per-slot attribution meaningless.
      */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={dismissed ? "Show Smart Cart suggestions" : "Dismiss Smart Cart suggestions"}
        aria-expanded={!dismissed}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: dismissed ? "var(--color-ink-faint)" : "#e23744" }}
      >
        {dismissed ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
}

function SkeletonRows() {
  // Exactly PANEL_ROW_COUNT rows at exactly the resolved row height, so the
  // panel cannot change height when the request resolves. (EDGE_CASES F1)
  return (
    <ul aria-hidden>
      {Array.from({ length: PANEL_ROW_COUNT }, (_, i) => (
        <li
          key={i}
          className="border-t border-[color-mix(in_srgb,var(--color-panel-accent)_14%,transparent)] first:border-t-0"
        >
          <div className={`flex items-center gap-3 px-3 ${PANEL_ROW_HEIGHT_CLASS}`}>
            <div className="panel-shimmer h-12 w-12 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="panel-shimmer h-3 w-3/4 rounded" />
              <div className="panel-shimmer h-2.5 w-1/2 rounded" />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="panel-shimmer h-6 w-14 rounded-lg" />
              <div className="panel-shimmer h-3 w-8 rounded" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function SmartCartPanel() {
  const { lines } = useCart();
  const [state, setState] = useState<PanelState>({ status: "loading" });
  const [dismissed, setDismissed] = useState(false);
  const [exiting, setExiting] = useState<Set<ProductId>>(new Set());

  /**
   * The signature captured at mount, held for the life of the visit so that
   * adding from the panel — which changes the real cart signature — cannot
   * trigger a recompute.
   *
   * A ref rather than state on purpose: nothing rendered depends on it (only
   * the two event payloads do), so making it state would schedule a render
   * that changes nothing on screen.
   *
   * It doubles as the guard against React StrictMode's deliberate double
   * invocation of effects in development, which would otherwise double every
   * panel_impression and burn two requests against a rate-limited free tier.
   * (EDGE_CASES G1)
   */
  const visitSignature = useRef<CartSignature | null>(null);

  useEffect(() => {
    if (visitSignature.current !== null) return;
    const signature = cartSignature();
    visitSignature.current = signature;

    const startedAt = Date.now();

    // No in-flight cancellation flag here, deliberately. The ref guard above
    // already means this fetch happens exactly once per mounted panel, and the
    // two mechanisms are mutually exclusive: under StrictMode the first effect
    // starts the request, its cleanup would set `cancelled`, and the second
    // effect returns early on the guard — so the resolving response is thrown
    // away and the panel sits on its skeleton forever. A stray state update
    // after a genuine unmount is harmless in React 18+.
    (async () => {
      // Spec §4 Step 2: a cached signature renders and stops, with no network
      // call. Checked inside this async body rather than in the effect body so
      // the state update lands in a continuation — the first paint has to be
      // the skeleton regardless, because reading storage during render would
      // desynchronise the server and client trees. (EDGE_CASES C1)
      const cached = getCachedPanel(signature);
      if (cached) {
        setState({ status: "ready", response: cached });
        return;
      }

      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Read imperatively, not from the hook, so this effect can stay
          // mount-only without taking the cart as a dependency.
          body: JSON.stringify({ cart: getCart(), signature }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response = (await res.json()) as RecommendResponse;

        if (!Array.isArray(response.rows) || response.rows.length === 0) {
          setState({ status: "empty" });
          return;
        }

        setCachedPanel(signature, response);
        setState({ status: "ready", response });

        logEvent("recommend_call", {
          latencyMs: Date.now() - startedAt,
          outcome: response.outcome ?? (response.source === "model" ? "model" : "fallback_error"),
        });
      } catch {
        // The panel is an enhancement; it must never break the checkout page.
        setState({ status: "empty" });
        logEvent("recommend_call", {
          latencyMs: Date.now() - startedAt,
          outcome: "fallback_error",
        });
      }
    })();

    // Mount-only by design. The cart is read imperatively inside, so a cart
    // change cannot re-trigger it — that is what "computed for the visit, not
    // for the cart" means in practice.
  }, []);

  // Logged once per resolved panel, not per render.
  const impressionLogged = useRef(false);
  useEffect(() => {
    if (state.status !== "ready" || impressionLogged.current) return;
    impressionLogged.current = true;

    const { rows, source } = state.response;
    logEvent("panel_impression", {
      products: rows.map((r) => r.productId),
      slots: rows.map((r) => r.slot),
      tiles: rows.map((r) => r.tile),
      cartSignature: visitSignature.current ?? "",
      source,
    });
  }, [state]);

  const handleDismiss = useCallback(() => {
    // The log stays OUTSIDE the state updater. React deliberately invokes
    // updater functions twice under StrictMode to surface impure ones, so a
    // logEvent in there fires twice per click — which was silently doubling
    // panel_dismiss, the exact kind of metric corruption StrictMode exists to
    // catch. Updaters must be pure functions of previous state.
    if (!dismissed) {
      logEvent("panel_dismiss", { cartSignature: visitSignature.current ?? "" });
    }
    setDismissed(!dismissed);
  }, [dismissed]);

  if (state.status === "empty") return null;

  const cartQuantities = new Map(lines.map((line) => [line.productId, line.quantity]));
  const rows = state.status === "ready" ? state.response.rows : [];

  // A row is visible until its product is in the cart — and stays mounted for
  // the length of its exit animation so the collapse is legible.
  const visibleRows = rows.filter(
    (row) => !cartQuantities.has(row.productId) || exiting.has(row.productId)
  );

  const handleAdd = (productId: ProductId) => {
    const row = rows.find((r) => r.productId === productId);
    const product = getProduct(productId);
    if (!row || !product) return;

    setExiting((prev) => new Set(prev).add(productId));
    window.setTimeout(() => {
      setExiting((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }, PANEL_ROW_EXIT_MS);

    addToCart(productId, 1);
    logEvent("panel_add", {
      productId,
      slot: row.slot,
      tile: row.tile,
      position: row.position,
    });
    logEvent("cart_add", { productId, tile: product.tile, source: "panel" });
  };

  return (
    <section
      aria-label="Smart Cart suggestions"
      className="mx-3 my-2 rounded-xl border border-dashed"
      style={{
        backgroundColor: "var(--color-panel-tint)",
        borderColor: "color-mix(in srgb, var(--color-panel-accent) 35%, transparent)",
      }}
    >
      <PanelHeader dismissed={dismissed} onToggle={handleDismiss} />

      {dismissed ? null : state.status === "loading" ? (
        <SkeletonRows />
      ) : (
        <ul>
          {visibleRows.map((row) => (
            <RecommendationRow
              key={row.productId}
              row={row}
              quantity={cartQuantities.get(row.productId) ?? 0}
              exiting={exiting.has(row.productId)}
              onAdd={() => handleAdd(row.productId)}
              onIncrement={() => addToCart(row.productId, 1)}
              onDecrement={() => {
                const current = cartQuantities.get(row.productId) ?? 0;
                if (current <= 1) removeFromCart(row.productId);
                else setQuantity(row.productId, current - 1);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
