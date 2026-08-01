"use client";

import { useEffect } from "react";

import { getSession, handleResetParam } from "@/lib/session";

/**
 * Runs the two things that must happen once per load: honour `?reset=1`, then
 * ensure a session exists.
 *
 * Renders nothing. It exists so the root layout can stay a server component
 * while still doing client-only work, and so that work happens in an effect
 * rather than during render — reading storage while rendering desynchronises
 * the server and client trees and breaks hydration. (EDGE_CASES C1)
 *
 * Order matters: reset must clear storage before a session is created, or the
 * reset immediately re-seeds the key it just removed.
 */
export default function AppBootstrap() {
  useEffect(() => {
    handleResetParam();
    getSession();
  }, []);

  return null;
}
