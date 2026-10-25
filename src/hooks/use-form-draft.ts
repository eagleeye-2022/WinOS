"use client";

import { useEffect, useEffectEvent, useState } from "react";

/**
 * Keeps a form's unsent input in this browser (localStorage) so it survives a reload, a closed
 * tab or reopening the app. Restores once on mount via `restore` (in an effect, so the server
 * render and hydration stay identical), then saves `values` on every change while `active`;
 * when `active` turns false (form closed, cancelled or submitted) the draft is removed.
 *
 * A per-browser convenience only — never the source of truth, and nothing reaches the DB.
 */
export function useFormDraft<T>(key: string | null, values: T, active: boolean, restore: (saved: T) => void) {
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const onRestore = useEffectEvent(restore);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) onRestore(JSON.parse(raw) as T);
    } catch {
      // Storage blocked or a corrupt draft — start empty.
    }
    setRestoredKey(key);
  }, [key]);

  const serialized = JSON.stringify(values);
  useEffect(() => {
    // Wait for the restore above, or the empty initial values would overwrite the saved draft.
    if (!key || restoredKey !== key) return;
    try {
      if (active) localStorage.setItem(key, serialized);
      else localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }, [key, restoredKey, active, serialized]);
}
