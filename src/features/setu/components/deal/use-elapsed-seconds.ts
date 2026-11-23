"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Seconds since `startedAt` (ISO), ticking every second while a timer runs; 0 when none.
 * Also 0 during server render and hydration (the server's clock ≠ the browser's), so a running
 * timer never causes a hydration mismatch — it starts ticking right after.
 */
export function useElapsedSeconds(startedAt: string | undefined): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!startedAt) return () => {};
      const id = window.setInterval(onChange, 1000);
      return () => window.clearInterval(id);
    },
    [startedAt]
  );
  const now = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null
  );
  return startedAt && now !== null ? Math.max(0, (now - Date.parse(startedAt)) / 1000) : 0;
}
