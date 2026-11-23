"use client";

import { useSyncExternalStore } from "react";

const STEP = 30_000;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, STEP);
  return () => window.clearInterval(id);
}

/**
 * The current time, rounded to 30s and refreshed every 30s — or null while server-rendering /
 * hydrating, so "in 15 minutes" style text never causes a hydration mismatch.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / STEP) * STEP,
    () => null
  );
}
