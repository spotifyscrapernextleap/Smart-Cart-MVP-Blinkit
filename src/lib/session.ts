/**
 * Session identity and the `?reset=1` escape hatch.
 *
 * There is no login and exactly one persona, so a "session" here is only what
 * ties a run of events together for later analysis.
 */

import { STORAGE_KEYS, clearAll, getItem, isSession, setItem } from "./storage";
import type { Session } from "./types";

/** Query parameter that wipes all app state on load. Spec §3.5. */
export const RESET_PARAM = "reset";

function newSessionId(): string {
  // crypto.randomUUID is unavailable on http:// origins in some browsers, and
  // this id only has to be unique within one person's localStorage.
  const random = Math.random().toString(36).slice(2, 10);
  return `s_${Date.now().toString(36)}_${random}`;
}

/**
 * Returns the current session, creating one on first load.
 * Client-only — never call during render. (EDGE_CASES C1)
 */
export function getSession(): Session {
  const existing = getItem<Session | null>(STORAGE_KEYS.session, null, (
    value
  ): value is Session | null => value === null || isSession(value));

  if (existing) return existing;

  const session: Session = {
    sessionId: newSessionId(),
    startedAt: new Date().toISOString(),
  };
  setItem(STORAGE_KEYS.session, session);
  return session;
}

/**
 * If `?reset=1` is present, clear every key and strip the parameter.
 *
 * The parameter is removed with replaceState rather than push, so a back
 * navigation cannot land on the reset URL and silently wipe state a second
 * time. (EDGE_CASES C6)
 *
 * @returns true if a reset was performed.
 */
export function handleResetParam(): boolean {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get(RESET_PARAM) !== "1") return false;

  clearAll();

  url.searchParams.delete(RESET_PARAM);
  const query = url.searchParams.toString();
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${query ? `?${query}` : ""}${url.hash}`
  );
  return true;
}
