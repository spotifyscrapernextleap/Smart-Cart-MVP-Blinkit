/**
 * Append-only event log in localStorage.
 *
 * The /metrics page that reads these is deferred, but the writes ship in v1.
 * Retrofitting event calls into finished components is the expensive part; the
 * page that reads them is trivial. Defer the writes too and every session run
 * before the page exists is lost. (Build spec §3.6)
 *
 * Call sites are added by the phase that owns the interaction. Phase 8 verifies
 * the full set.
 */

import { EVENT_LOG_CAP } from "./config.ts";
import { getSession } from "./session.ts";
import { STORAGE_KEYS, getItem, isEventLog, setItem } from "./storage.ts";
import type { AppEvent, EventPayloads, EventType } from "./types";

function newEventId(): string {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readEvents(): AppEvent[] {
  return getItem<AppEvent[]>(STORAGE_KEYS.events, [], isEventLog);
}

/**
 * Appends one event. Client-only and deliberately silent on failure — a metrics
 * write must never be the reason an interaction breaks.
 */
export function logEvent<T extends EventType>(
  type: T,
  payload: EventPayloads[T]
): void {
  if (typeof window === "undefined") return;

  try {
    const event: AppEvent<T> = {
      id: newEventId(),
      timestamp: new Date().toISOString(),
      type,
      sessionId: getSession().sessionId,
      payload,
    };

    const log = readEvents();
    log.push(event as AppEvent);

    // Trim on write, never on read: a reader that trims would make the log's
    // length depend on who looked at it last.
    const trimmed =
      log.length > EVENT_LOG_CAP ? log.slice(log.length - EVENT_LOG_CAP) : log;

    setItem(STORAGE_KEYS.events, trimmed);
  } catch (error) {
    console.warn("logEvent failed", type, error);
  }
}

export function clearEvents(): void {
  setItem(STORAGE_KEYS.events, []);
}
