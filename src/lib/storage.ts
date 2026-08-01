/**
 * Typed localStorage wrapper.
 *
 * Two failure modes are handled here rather than at every call site:
 *
 *   - localStorage is unreachable. Safari private mode throws on write, quota
 *     can be exhausted, and storage can be disabled outright. The app must keep
 *     running and lose only persistence, so every access falls back to an
 *     in-memory map. (EDGE_CASES C3)
 *   - The stored value is not what we expect. Anything hand-edited in devtools,
 *     or written by an older build, must not crash a render. A failed parse or
 *     a failed shape check clears that key and returns the caller's default.
 *     (EDGE_CASES C4)
 *
 * Nothing here may be called during render. Reading storage while rendering
 * makes the server produce one tree and the client another, and React fails
 * hydration. Call from useEffect or from an event handler. (EDGE_CASES C1)
 */

import type { AppEvent, CartLine, RecommendResponse, Session } from "./types";

export const STORAGE_KEYS = {
  cart: "sc_cart",
  events: "sc_events",
  session: "sc_session",
  panelCache: "sc_panel_cache",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Used whenever the real localStorage is unavailable, so behaviour stays uniform. */
const memoryFallback = new Map<string, string>();

let storageWarned = false;

function warnOnce(error: unknown) {
  if (storageWarned) return;
  storageWarned = true;
  console.warn("localStorage unavailable; falling back to memory", error);
}

/** Null on the server. Never throws. */
function getStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    // Touch the API rather than trusting its presence: Safari private mode
    // exposes localStorage and then throws on use.
    const probe = "__sc_probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (error) {
    warnOnce(error);
    return null;
  }
}

function readRaw(key: StorageKey): string | null {
  const store = getStore();
  if (!store) return memoryFallback.get(key) ?? null;
  try {
    return store.getItem(key);
  } catch (error) {
    warnOnce(error);
    return memoryFallback.get(key) ?? null;
  }
}

function writeRaw(key: StorageKey, value: string): void {
  memoryFallback.set(key, value);
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch (error) {
    // Most likely a quota error. The in-memory copy above keeps the session
    // coherent; only persistence across a reload is lost.
    warnOnce(error);
  }
}

/**
 * Read and validate a stored value.
 *
 * `isValid` is not optional on purpose. A parse that succeeds proves the value
 * is JSON, not that it is the right shape — and the shape is exactly what a
 * stale build or a devtools edit gets wrong.
 */
export function getItem<T>(
  key: StorageKey,
  fallback: T,
  isValid: (value: unknown) => value is T
): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeItem(key);
    return fallback;
  }

  if (!isValid(parsed)) {
    removeItem(key);
    return fallback;
  }
  return parsed;
}

export function setItem<T>(key: StorageKey, value: T): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch (error) {
    // JSON.stringify throws on circular structures. Nothing we store is
    // circular, so this means a caller passed something unexpected.
    console.warn(`failed to serialise ${key}`, error);
  }
}

export function removeItem(key: StorageKey): void {
  memoryFallback.delete(key);
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch (error) {
    warnOnce(error);
  }
}

/** Clears every key this app owns. Backs `?reset=1`. */
export function clearAll(): void {
  for (const key of Object.values(STORAGE_KEYS)) removeItem(key);
}

// ---------------------------------------------------------------------------
// Shape guards
//
// Deliberately shallow. They exist to stop a crash, not to prove correctness —
// deeper validation belongs where the domain rules live (cart.ts filters ids
// that are no longer in the catalogue, for instance).
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCartLines(value: unknown): value is CartLine[] {
  return (
    Array.isArray(value) &&
    value.every(
      (line) =>
        isRecord(line) &&
        typeof line.productId === "string" &&
        typeof line.quantity === "number" &&
        Number.isFinite(line.quantity)
    )
  );
}

export function isEventLog(value: unknown): value is AppEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (event) =>
        isRecord(event) &&
        typeof event.id === "string" &&
        typeof event.type === "string" &&
        typeof event.sessionId === "string"
    )
  );
}

export function isSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    typeof value.sessionId === "string" &&
    typeof value.startedAt === "string"
  );
}

export function isPanelCache(
  value: unknown
): value is Record<string, RecommendResponse> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => isRecord(entry) && Array.isArray(entry.rows)
    )
  );
}
