/**
 * POST /api/recommend — the only server-side file in the application.
 *
 * Phase 4 delivered the deterministic panel; Phase 6 layers the model on top of
 * it. The order matters and is not incidental: the fallback is the panel's
 * default state, so every failure path here — no key, timeout, 429, non-200,
 * unparseable body, nothing surviving validation — lands on a panel that was
 * already correct before the model existed. The response always has four rows.
 *
 * `GROQ_API_KEY` is read **here and nowhere else**, and never with a
 * `NEXT_PUBLIC_` prefix. This file never ships to the browser, which is what
 * makes that guarantee structural rather than a convention. (EDGE_CASES E1)
 *
 * Seed data is imported statically and resolved at build — no filesystem read
 * and no network at request time. (Build spec §4, Step 4)
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  GROQ_BASE_URL,
  GROQ_MODEL,
  MODEL_MAX_COMPLETION_TOKENS,
  MODEL_REASONING_EFFORT,
  MODEL_TEMPERATURE,
  MODEL_TIMEOUT_MS,
} from "@/lib/config";
import {
  buildFallbackPanel,
  buildRows,
  buildShortlistMap,
} from "@/lib/recommend/fallback";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/recommend/prompt";
import { buildShortlists, type ShortlistSet } from "@/lib/recommend/shortlist";
import { resolveModelPanel } from "@/lib/recommend/validate";
import type { CartLine, RecommendOutcome, RecommendResponse } from "@/lib/types";

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

type FailureOutcome = Exclude<RecommendOutcome, "model">;

type ModelAttempt =
  | { ok: true; raw: string }
  | { ok: false; outcome: FailureOutcome };

/**
 * Which fallback this was. On screen a fallback panel and a model panel are
 * identical, so this is the only thing that can tell an operator whether the
 * model path is dead and why — which is exactly what spec §6 Phase 9's test
 * looks at on the deployed URL. 429 is separated from other errors per §7.5,
 * because the free tier caps requests/min, tokens/min and requests/day at once
 * and hitting any of them looks like a generic outage otherwise.
 */
function classifyFailure(error: unknown, aborted: boolean): FailureOutcome {
  if (aborted) return "fallback_timeout";
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 429) return "fallback_ratelimit";
  return "fallback_error";
}

async function attemptModel(cart: CartLine[], set: ShortlistSet): Promise<ModelAttempt> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, outcome: "fallback_nokey" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: GROQ_BASE_URL,
      // The SDK retries twice by default. Both retries would be spent inside
      // the same 4s budget the abort above enforces, so they cannot produce a
      // usable answer — and on a 429 they would spend two more requests against
      // the limit that just rejected us. One attempt, then the fallback.
      maxRetries: 0,
    });

    const completion = await client.chat.completions.create(
      {
        model: GROQ_MODEL,
        temperature: MODEL_TEMPERATURE,
        max_completion_tokens: MODEL_MAX_COMPLETION_TOKENS,
        reasoning_effort: MODEL_REASONING_EFFORT,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(cart, set) },
        ],
      },
      { signal: controller.signal }
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    return raw.trim().length > 0
      ? { ok: true, raw }
      : { ok: false, outcome: "fallback_invalid" };
  } catch (error) {
    return { ok: false, outcome: classifyFailure(error, controller.signal.aborted) };
  } finally {
    clearTimeout(timer);
  }
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

  const set = buildShortlists(cart);
  const attempt = await attemptModel(cart, set);

  if (attempt.ok) {
    const resolved = resolveModelPanel(set, attempt.raw);

    if (resolved) {
      const panel: RecommendResponse = {
        source: "model",
        cartSignature,
        rows: buildRows(resolved.shortlists, (shortlist) => {
          const choice = resolved.choices.get(shortlist.tile);
          if (!choice) return undefined; // backfilled row: template product and line
          return { productId: choice.productId, reason: choice.reason ?? undefined };
        }),
        shortlists: buildShortlistMap(resolved.shortlists),
        outcome: "model",
      };
      return NextResponse.json(panel);
    }
  }

  // Whole-response validation failure is its own diagnosis: the call succeeded,
  // so the key and the region are fine and the prompt or the model is not.
  const outcome: FailureOutcome = attempt.ok ? "fallback_invalid" : attempt.outcome;
  const panel: RecommendResponse = {
    ...buildFallbackPanel(set, cartSignature),
    outcome,
  };
  return NextResponse.json(panel);
}
