/**
 * POST /api/recommend — the only server-side file in the application.
 *
 * Phase 4 delivers the deterministic path only: no API key, no network call,
 * `source: "fallback"` on every response. Phase 6 layers the model on top and
 * falls through to exactly this code on any failure.
 *
 * Seed data is imported statically and resolved at build — no filesystem read
 * and no network at request time. (Build spec §4, Step 4)
 */

import { NextResponse } from "next/server";

import { buildFallbackPanel } from "@/lib/recommend/fallback";
import { buildShortlists } from "@/lib/recommend/shortlist";
import type { CartLine } from "@/lib/types";

/** Mirrors cart.ts's signature format so a client and server signature agree. */
function signatureFor(cart: CartLine[]): string {
  return [...cart]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((line) => `${line.productId}:${line.quantity}`)
    .join("|");
}

/**
 * The request body arrives from a client that may be running older code, or
 * from curl during testing, so nothing in it is trusted. An unusable body
 * yields an empty cart rather than a 500 — the panel is supposed to render
 * regardless, and an empty cart is a legitimate state (no minimum cart size).
 */
function parseCart(body: unknown): CartLine[] {
  if (typeof body !== "object" || body === null) return [];
  const raw = (body as { cart?: unknown }).cart;
  if (!Array.isArray(raw)) return [];

  const lines: CartLine[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { productId, quantity } = entry as { productId?: unknown; quantity?: unknown };
    if (typeof productId !== "string") continue;
    const parsed = typeof quantity === "number" && Number.isFinite(quantity) ? quantity : 1;
    lines.push({ productId, quantity: Math.max(1, Math.floor(parsed)) });
  }
  return lines;
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON is treated as an empty cart, for the same reason as above.
  }

  const cart = parseCart(body);

  // The client sends its own signature so the response can be matched to the
  // cart that asked for it, but it is only trusted as a label — the panel
  // itself is always computed from the cart contents.
  const clientSignature = (body as { signature?: unknown } | null)?.signature;
  const cartSignature =
    typeof clientSignature === "string" ? clientSignature : signatureFor(cart);

  const shortlists = buildShortlists(cart);
  const panel = buildFallbackPanel(shortlists, cartSignature);

  // No model layer exists yet, which is indistinguishable from having no key
  // configured — and is the same thing the client needs to know either way.
  // Phase 6 replaces this with the real per-attempt outcome.
  return NextResponse.json({ ...panel, outcome: "fallback_nokey" });
}
